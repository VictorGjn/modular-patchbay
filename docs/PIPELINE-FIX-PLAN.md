# Pipeline Fix Plan — From Cosmetic to Real Context Engineering

**Objectif :** Résoudre les 5 problèmes structurels du pipeline : semantic collapse, compression naïve, absence de retrieval, navigation fragile, provenance cosmétique.

**Principe :** Chaque phase débloque la suivante. Pas de skip.

---

## Phase 1 — Embedding Foundation (la base de tout)
**Durée estimée :** 2-3 jours
**Débloque :** Phase 2, 3, 4

### Problème
Tout le pipeline repose sur du keyword matching (Jaccard, regex, fingerprint 8 mots). Sans similarité sémantique, rien ne marche réellement.

### Solution
Nouveau service `src/services/embeddingService.ts` :

```
Interface:
  embed(text: string): Promise<Float32Array>
  embedBatch(texts: string[]): Promise<Float32Array[]>
  similarity(a: Float32Array, b: Float32Array): number  // cosine
  nearestK(query: Float32Array, corpus: Float32Array[], k: number): {index, score}[]
```

**Backend options (au choix, configurable) :**

| Option | Latency | Quality | Cost | Offline |
|--------|---------|---------|------|---------|
| `@xenova/transformers` (e5-small-v2, ONNX) | ~50ms/chunk | Bon | 0€ | ✅ |
| OpenAI `text-embedding-3-small` | ~200ms/batch | Très bon | ~$0.02/1M tokens | ❌ |
| Mixte (local pour dedup, API pour retrieval) | Variable | Optimal | Minimal | Partiel |

**Recommandation :** Local ONNX par défaut (zero cost, offline), API optionnel pour les cas exigeants.

### Changements concrets
1. **Nouveau fichier :** `src/services/embeddingService.ts` — service avec cache LRU (embeddings sont déterministes, on re-calcule pas)
2. **Cache persistant :** `src/store/embeddingStore.ts` — IndexedDB, clé = hash(content), valeur = Float32Array. Survit aux reloads.
3. **Intégration dans treeIndexer :** Chaque `TreeNode` reçoit un champ optionnel `embedding?: Float32Array` calculé au moment de l'indexation
4. **Config UI :** Toggle dans Settings → "Embedding Provider" (local/openai/off)

### Critère de validation
```typescript
// Ce test doit passer :
const sim = similarity(
  await embed("Le navire consomme trop de fuel"),
  await embed("La consommation de carburant du vessel est excessive")
);
assert(sim > 0.85); // Même sens, mots différents

const sim2 = similarity(
  await embed("Le navire consomme trop de fuel"),
  await embed("Le restaurant ferme à 22h")
);
assert(sim2 < 0.3); // Sens différent
```

---

## Phase 2 — Query-Aware Retrieval (remplacer la navigation agent)
**Durée estimée :** 3-4 jours
**Requiert :** Phase 1
**Débloque :** Phase 4

### Problème
Le pipeline charge TOUTES les branches, puis tronque au budget. La "navigation agent" (3 appels LLM) est un routeur coûteux, pas un retriever. On paie 3 LLM calls pour un résultat qu'un embedding fait mieux en 50ms.

### Solution
Nouveau service `src/services/chunkRetriever.ts` :

**Étape A — Chunking intelligent**
Remplacer le split par headings (trop gros) par un chunking sémantique :
```
1. Split par paragraphes (double newline)
2. Grouper les paragraphes consécutifs qui traitent du même sujet (similarité > 0.8)
3. Cible : chunks de 200-500 tokens (assez pour être autonomes, assez petits pour être précis)
4. Chaque chunk garde : source, section, type, position dans l'arbre
```

**Étape B — Retrieval par scoring**
```
Pour chaque query :
  1. Embed la query
  2. Calculer cosine similarity query ↔ chaque chunk
  3. Filtrer : score > threshold (0.3 minimum)
  4. Classer par score décroissant
  5. Appliquer MMR pour diversité (Phase 4)
  6. Prendre les top-K chunks qui tiennent dans le budget
```

**Étape C — Remplacement de la navigation agent**
```
AVANT (3 LLM calls, ~2-5s, ~$0.01-0.03) :
  headlines → LLM navigation → LLM critique → LLM gap-fill → concatenate

APRÈS (0 LLM calls, ~100ms, $0) :
  chunks → embed query → cosine ranking → MMR filter → budget pack
```

### Changements concrets
1. **Nouveau :** `src/services/chunkRetriever.ts` — semantic chunking + retrieval
2. **Modifier :** `knowledgePipeline.ts` — remplacer `callLlmForNavigation` + `buildCritiquePrompt` + `reNavigateForGaps` par `chunkRetriever.retrieve(query, budget)`
3. **Garder :** La navigation agent comme mode optionnel ("agent-driven" dans le toggle) pour les cas complexes, mais le **défaut devient embedding retrieval**
4. **Supprimer :** HyDE prompt (l'embedding de la query suffit), corrective re-navigation (MMR couvre les gaps)

### Critère de validation
```
Scénario : 3 sources de knowledge (Odfjell docs, réglementation EU ETS, architecture Syroco)
Query : "Comment intégrer le coût EU ETS dans Voyage Prep?"

AVANT : Navigation agent sélectionne 2 branches sur 3, rate la section architecture
APRÈS : Retriever remonte les chunks pertinents des 3 sources, ordonnés par pertinence
Temps : < 200ms vs > 3s
Coût : 0 vs ~$0.02
```

---

## Phase 3 — Semantic Compression (LLM-powered)
**Durée estimée :** 2-3 jours
**Requiert :** Phase 1 (pour mesurer la quality loss)
**Indépendant de :** Phase 2

### Problème
`compress.ts` fait du text processing (dedup fingerprint 8 mots, filler regex, truncation). Ce n'est pas de la compression — c'est du nettoyage de surface. Un chunk de 500 tokens avec du bruit reste à ~450 tokens après "compression".

### Solution
Compression en 2 niveaux dans `src/services/semanticCompressor.ts` :

**Niveau 1 — Extractive (rapide, sans LLM)**
```
1. Semantic dedup : remplacer fingerprint par cosine similarity (Phase 1)
   - Seuil : 0.92+ = duplicate → supprimer
   - Seuil : 0.85-0.92 = near-duplicate → garder le plus complet
2. Sentence ranking : TF-IDF-like scoring des phrases par rapport à la query
   - Garder les phrases à haute densité informationnelle
   - Supprimer les phrases redondantes avec le contexte déjà sélectionné
3. Conserver le filler removal regex existant (il marche pour le bruit évident)
```

**Niveau 2 — Abstractive (LLM, optionnel, pour les gros budgets)**
```
Uniquement quand :
  - Le budget est tight (utilization > 0.8 après extractive)
  - La source est de type "evidence" ou "signal" (pas ground-truth — on ne résume pas des specs)

Prompt :
  "Condense ce chunk en gardant TOUS les faits, chiffres, et relations.
   Supprime la prose, les transitions, les exemples redondants.
   Budget : {target_tokens} tokens.
   NE PAS halluciner de nouvelles informations."

Validation : comparer l'embedding du résumé vs original — similarity > 0.85 ou reject
```

### Changements concrets
1. **Nouveau :** `src/services/semanticCompressor.ts` — extractive + abstractive
2. **Modifier :** `compress.ts` → garder comme "level 0" (filler/code cleanup), appeler `semanticCompressor` pour level 1-2
3. **Config :** "Compression Level" dans Settings (0=text only, 1=extractive, 2=extractive+abstractive)
4. **Métriques :** Afficher dans le pipeline stats : compression ratio, quality score (embedding sim original→compressed), tokens saved

### Critère de validation
```
Input : Chunk de 800 tokens sur la réglementation EU ETS (beaucoup de prose légale)
Level 0 (actuel) : 720 tokens (ratio 0.90) — juste du filler removal
Level 1 (extractive) : 400 tokens (ratio 0.50) — phrases clés uniquement
Level 2 (abstractive) : 250 tokens (ratio 0.31) — faits condensés

Quality check : similarity(embed(original), embed(compressed)) > 0.85 pour tous les niveaux
```

---

## Phase 4 — Anti-Collapse (diversité forcée)
**Durée estimée :** 2 jours
**Requiert :** Phase 1 + Phase 2

### Problème
Le "semantic collapse" : quand plusieurs sources parlent du même sujet, le retriever remonte N variations du même angle. Le LLM reçoit un contexte qui semble riche (beaucoup de tokens) mais est sémantiquement pauvre (un seul point de vue).

### Solution

**A — MMR (Maximal Marginal Relevance) dans le retriever**
```
Au lieu de top-K par score brut :

score_mmr(chunk) = λ * similarity(query, chunk) 
                 - (1-λ) * max(similarity(chunk, already_selected))

λ = 0.7 par défaut (favorise pertinence, mais pénalise redondance)

Algorithme :
  1. Sélectionner le chunk le plus pertinent
  2. Pour chaque chunk suivant, calculer MMR score
  3. Sélectionner le meilleur MMR score
  4. Répéter jusqu'au budget
```

**B — Collapse Detection (monitoring)**
```
Après sélection des chunks :
  1. Calculer la matrice de similarité entre tous les chunks sélectionnés
  2. Variance des similarités inter-chunks
  3. Si variance < seuil (0.15) → flag "semantic collapse detected"
  4. Forcer l'injection de chunks à faible similarité avec le cluster dominant
```

**C — Contrastive Retrieval réel (remplace le regex actuel)**
```
AVANT : regex "however", "but", "unlike" → binaire, lexical
APRÈS :
  1. Pour chaque cluster de chunks similaires, chercher des chunks qui :
     - Partagent des entités (même sujet) → cosine sur entités > 0.5
     - Mais divergent sur le contenu → cosine sur contenu < 0.5
  2. Ces chunks "contrastifs" sont scorés positivement par MMR
  3. Injection dans le contexte avec tag <contrasting>
```

### Changements concrets
1. **Modifier :** `chunkRetriever.ts` (Phase 2) → ajouter MMR scoring
2. **Nouveau :** `src/services/collapseDetector.ts` — variance check + forced diversity
3. **Remplacer :** `contrastiveRetrieval.ts` — jeter le regex matching, utiliser les embeddings
4. **UI :** Indicateur "Diversity Score" dans le pipeline stats (0-1, 1 = max diversité)

### Critère de validation
```
Scénario : 3 docs qui parlent tous d'optimisation de route maritime
  - Doc A : "Réduire la vitesse économise du fuel"
  - Doc B : "La réduction de vitesse améliore l'efficacité énergétique"  
  - Doc C : "L'augmentation de vitesse en courant favorable peut être plus efficace"

AVANT : Les 3 sont sélectionnés (pas de dedup sémantique), A+B = collapse
APRÈS : 
  - A+B détectés comme near-duplicates (cosine > 0.88) → garder A (plus complet)
  - C détecté comme contrastif (même sujet, angle différent) → boosté par MMR
  - Diversity score : 0.7+ (vs 0.3 avant)
```

---

## Phase 5 — Provenance Actionnable
**Durée estimée :** 2-3 jours
**Requiert :** Phase 2 (chunks avec metadata)
**Indépendant de :** Phase 3, 4

### Problème
La provenance actuelle = tags XML décoratifs. Rien ne vérifie que le LLM les utilise. `resolveConflicts` est un stub.

### Solution

**A — Provenance structurée par chunk**
```
Chaque chunk dans le contexte final porte :
  <chunk id="c17" source="odfjell-ops.md" section="Speed Policy" 
         type="ground-truth" retrieved_at="2025-03-15T10:23:00Z"
         relevance="0.87" diversity_contribution="0.34">
    ...contenu...
  </chunk>
```

**B — Citation tracking en post-process**
```
Après la réponse LLM :
  1. Pour chaque phrase de la réponse, calculer la similarité avec chaque chunk source
  2. Mapper : "cette phrase vient probablement de chunk c17 (sim=0.82)"
  3. Générer un rapport de citations :
     - Chunks utilisés vs ignorés
     - Phrases non-sourcées (potentielles hallucinations)
     - Coverage : % du contexte effectivement utilisé
```

**C — Conflict Resolution réelle**
```
Quand deux chunks de même sujet (cosine entités > 0.6) mais contenu divergent (cosine contenu < 0.4) :
  1. Comparer les types épistémiques : ground-truth > evidence > signal > hypothesis
  2. Comparer la fraîcheur : plus récent = prioritaire (si timestamp disponible)
  3. Injecter une instruction explicite :
     "<conflict>
       Chunk c17 (ground-truth, 2025-01) dit X.
       Chunk c23 (signal, 2024-09) dit Y.
       Privilégier c17 (type supérieur + plus récent).
     </conflict>"
```

### Changements concrets
1. **Modifier :** Assembly final → chaque chunk a un `id` unique + metadata de retrieval
2. **Nouveau :** `src/services/citationTracker.ts` — post-hoc similarity matching response ↔ chunks
3. **Modifier :** `provenanceService.ts` → `resolveConflicts` avec vraie logique (embeddings + type hierarchy)
4. **UI :** Panel "Citations" dans RuntimeResults — heatmap chunks utilisés/ignorés, alertes hallucination

### Critère de validation
```
Scénario : Réponse LLM mentionne "Odfjell utilise une vitesse de 12 nœuds"
Citation tracker :
  - Match chunk c17 "Speed Policy" (sim=0.84) → ✅ Sourcé
  - Phrase "La consommation optimale est de 15t/jour" → aucun chunk > 0.5 → ⚠️ Non-sourcé (possible hallucination)
```

---

## Séquençage

```
Semaine 1 :  Phase 1 (Embeddings)     ████████████████████
Semaine 2 :  Phase 2 (Retrieval)      ████████████████████████████
             Phase 3 (Compression)    ██████████████████
Semaine 3 :  Phase 4 (Anti-Collapse)  ████████████████
             Phase 5 (Provenance)     ████████████████████
```

**Phase 1 est critique path.** Sans embeddings, rien d'autre ne fonctionne.
Phases 2+3 peuvent être parallélisées. Phase 4 dépend de 1+2. Phase 5 dépend de 2.

## Métriques de succès globales

| Métrique | Avant | Cible |
|----------|-------|-------|
| Retrieval : appels LLM pour navigation | 1-3 par query | 0 (embedding only) |
| Retrieval : latence | 2-5s | < 200ms |
| Compression ratio (evidence/signal) | 0.90 | 0.40-0.60 |
| Semantic dedup accuracy | ~60% (lexical) | > 95% (embedding) |
| Diversity score (contexte assemblé) | Non mesuré | > 0.6 |
| Citation coverage (chunks utilisés) | Non mesuré | > 70% |
| Hallucination detection | Aucune | Flagging phrases non-sourcées |
| Coût par query | ~$0.02-0.05 (nav LLM) | ~$0 (local embeddings) |

## Décisions architecturales à prendre

1. **Embedding model :** `e5-small-v2` (33M params, 384 dims) vs `gte-small` (33M, 384) vs `nomic-embed-text` (137M, 768)?
   → Recommandation : `e5-small-v2` — meilleur rapport qualité/taille, bien documenté pour ONNX
   
2. **Chunk store :** IndexedDB (client-side) vs SQLite via server?
   → Recommandation : IndexedDB pour la v1, migration SQLite si on fait un mode serveur

3. **MMR lambda :** Configurable par l'utilisateur ou fixé?
   → Recommandation : Fixé à 0.7, exposer dans "Advanced Settings" pour power users

4. **Abstractive compression :** Même provider/model que le chat ou dédié?
   → Recommandation : Même provider, model plus petit si disponible (e.g. gpt-4o-mini si le chat est sur gpt-4o)
