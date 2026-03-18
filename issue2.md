## Problem

The current `treeIndexer` only handles markdown headings and basic file indexing. For TypeScript/Python code files, it doesn't extract semantic structure:
- No awareness of exports, imports, types, interfaces, classes
- Missing function signatures and class hierarchies  
- No code dependency mapping
- Depth levels don't map meaningfully to code structure

This limits the agent's understanding of codebases and reduces context quality for development agents.

## Proposed Solution

Create a new `codeIndexer.ts` that provides code-aware indexing for TypeScript/JavaScript and Python files:

1. **Structure Extraction**: Parse exports, types/interfaces/DTOs, function signatures, class hierarchies
2. **Dependency Mapping**: Track imports and cross-file dependencies
3. **Semantic Depth Levels**: Map depth to appropriate abstraction levels
4. **Tree Integration**: Generate structured `TreeNode` output compatible with existing pipeline

## Types & Interfaces

From existing `treeIndexStore`:
```typescript
interface TreeNode {
  title: string;
  id: string;
  content: string;
  children?: TreeNode[];
  depth: number;
}

interface TreeIndex {
  nodes: TreeNode[];
  totalTokens: number;
  metadata?: Record<string, any>;
}
```

New interfaces needed:
```typescript
interface CodeStructure {
  exports: Export[];
  types: TypeDefinition[];
  functions: FunctionSignature[];
  classes: ClassDefinition[];
  imports: Import[];
}

interface Export {
  name: string;
  type: 'function' | 'class' | 'type' | 'const' | 'default';
  signature?: string;
  location: { line: number; column: number };
}
```

## Behaviors

1. **TypeScript/JavaScript Extraction**:
   - Regex-based parsing for `export`, `interface`, `type`, `class`, `function`
   - Extract JSDoc comments and type annotations
   - Handle named exports, default exports, re-exports

2. **Python Extraction**:
   - Parse `def`, `class`, `import`, `from ... import`
   - Extract docstrings and type hints
   - Handle module structure and decorators

3. **Depth Level Mapping**:
   - **Full (100%)**: Complete source code
   - **Detail (75%)**: Signatures + docstrings + implementation summaries
   - **Summary (50%)**: Module overview + public interface + key classes
   - **Headlines (25%)**: Feature/module list + main exports
   - **Mention (10%)**: File purpose + primary exports only

## Edge Cases

- Handle malformed/incomplete code gracefully
- Support mixed file types in same directory
- Handle very large files (streaming/chunking)
- Preserve line number references for source mapping
- Handle TypeScript declaration files (.d.ts)
- Support JavaScript without TypeScript annotations

## Acceptance Criteria

- [ ] New file `src/utils/codeIndexer.ts` created
- [ ] TypeScript/JavaScript files generate structured tree indexes
- [ ] Python files generate structured tree indexes  
- [ ] Depth levels meaningfully reduce code complexity
- [ ] Integration with existing `TreeIndex` interface
- [ ] Handles files up to 50k+ lines without performance issues
- [ ] Preserves source location information for debugging
- [ ] Falls back gracefully for unparseable code

## Files to Modify

- Create `src/utils/codeIndexer.ts`
- Update `src/store/treeIndexStore.ts` to dispatch `indexSource()` vs `indexMarkdown()`
- Modify `src/panels/knowledge/LocalFilesPanel.tsx` to show code structure
- Update file type detection logic in indexing pipeline

## Estimate

**Large (L)** - New core feature requiring regex parsing, AST understanding, and pipeline integration. Estimated 2-3 day sprint.