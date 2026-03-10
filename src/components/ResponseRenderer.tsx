import { useState, useMemo, lazy, Suspense, useCallback } from 'react';
import { useTheme } from '../theme';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';

// Lazy-load mermaid only when needed
const MermaidBlock = lazy(() => import('./MermaidBlock'));

/* ── Detection helpers ── */

type ContentSegment =
  | { type: 'markdown'; content: string }
  | { type: 'html'; content: string }
  | { type: 'code'; content: string; language: string }
  | { type: 'mermaid'; content: string }
  | { type: 'json'; content: string }
  | { type: 'yaml'; content: string }
  | { type: 'table'; content: string; rows: string[][] };

function isFullHtml(text: string): boolean {
  const trimmed = text.trim();
  return /^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);
}

function tryParseJson(text: string): boolean {
  const trimmed = text.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return false;
  try { JSON.parse(trimmed); return true; } catch { return false; }
}

function looksLikeYaml(text: string): boolean {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return false;
  return lines.every(l => /^\s*[\w.-]+\s*:/.test(l) || /^\s*-\s/.test(l) || l.trim() === '');
}

function parseCSV(text: string): string[][] | null {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(',') ? ',' : null;
  if (!sep) return null;
  const rows = lines.map(l => l.split(sep).map(c => c.trim()));
  const colCount = rows[0].length;
  if (colCount < 2 || rows.some(r => Math.abs(r.length - colCount) > 1)) return null;
  return rows;
}

function parseSegments(content: string): ContentSegment[] {
  // Full HTML document
  if (isFullHtml(content)) return [{ type: 'html', content }];

  // Pure JSON
  if (tryParseJson(content)) return [{ type: 'json', content }];

  // Pure YAML (no fenced blocks)
  if (!content.includes('```') && looksLikeYaml(content)) return [{ type: 'yaml', content }];

  // CSV/tabular
  if (!content.includes('```')) {
    const rows = parseCSV(content);
    if (rows) return [{ type: 'table', content, rows }];
  }

  // Split by fenced code blocks
  const segments: ContentSegment[] = [];
  const fenceRe = /^```(\w*)\s*$/gm;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const matches: { start: number; lang: string }[] = [];

  while ((match = fenceRe.exec(content)) !== null) {
    matches.push({ start: match.index, lang: match[1] });
  }

  // Pair opens/closes
  let i = 0;
  while (i < matches.length) {
    const open = matches[i];
    if (open.lang || i === 0) {
      // Find matching close (next ``` with no lang)
      let closeIdx = -1;
      for (let j = i + 1; j < matches.length; j++) {
        if (!matches[j].lang) { closeIdx = j; break; }
      }
      if (closeIdx === -1) { i++; continue; }

      const before = content.slice(lastIndex, open.start);
      if (before.trim()) segments.push({ type: 'markdown', content: before });

      const codeStart = open.start + open.lang.length + 4; // ``` + lang + \n
      const codeEnd = matches[closeIdx].start;
      const codeContent = content.slice(codeStart, codeEnd);
      const lang = open.lang.toLowerCase();

      if (lang === 'mermaid') {
        segments.push({ type: 'mermaid', content: codeContent.trim() });
      } else if (lang === 'json' && tryParseJson(codeContent)) {
        segments.push({ type: 'json', content: codeContent.trim() });
      } else if (lang === 'yaml' || lang === 'yml') {
        segments.push({ type: 'yaml', content: codeContent.trim() });
      } else if (lang === 'html') {
        segments.push({ type: 'html', content: codeContent.trim() });
      } else if (lang === 'csv') {
        const rows = parseCSV(codeContent);
        if (rows) segments.push({ type: 'table', content: codeContent.trim(), rows });
        else segments.push({ type: 'code', content: codeContent.trim(), language: lang });
      } else {
        segments.push({ type: 'code', content: codeContent.trim(), language: lang || 'text' });
      }

      lastIndex = matches[closeIdx].start + 3 + (content[matches[closeIdx].start + 3] === '\n' ? 1 : 0);
      i = closeIdx + 1;
    } else {
      i++;
    }
  }

  const remaining = content.slice(lastIndex);
  if (remaining.trim()) segments.push({ type: 'markdown', content: remaining });

  return segments.length ? segments : [{ type: 'markdown', content }];
}

/* ── Sub-renderers ── */

function CopyButton({ text }: { text: string }) {
  const t = useTheme();
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textDim, padding: 2 }}
      title="Copy"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function CodeBlock({ content, language }: { content: string; language: string }) {
  const t = useTheme();
  return (
    <div style={{ position: 'relative', margin: '4px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: t.isDark ? '#ffffff08' : '#00000008', borderRadius: '6px 6px 0 0', borderBottom: `1px solid ${t.borderSubtle}` }}>
        <span style={{ fontSize: 13, color: t.textDim, fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em' }}>{language}</span>
        <CopyButton text={content} />
      </div>
      <pre style={{
        background: t.isDark ? '#ffffff0a' : '#00000008',
        padding: 10,
        borderRadius: '0 0 6px 6px',
        overflow: 'auto',
        fontSize: 12,
        fontFamily: "'Geist Mono', monospace",
        color: t.textPrimary,
        margin: 0,
        lineHeight: 1.5,
      }}>
        <code>{content}</code>
      </pre>
    </div>
  );
}

function HtmlPreview({ content }: { content: string }) {
  const t = useTheme();
  return (
    <div style={{ margin: '4px 0', border: `1px solid ${t.borderSubtle}`, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: t.isDark ? '#ffffff08' : '#00000008', borderBottom: `1px solid ${t.borderSubtle}` }}>
        <span style={{ fontSize: 13, color: t.textDim, fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em' }}>HTML Preview</span>
      </div>
      <iframe
        srcDoc={content}
        sandbox="allow-scripts"
        style={{ width: '100%', height: 200, border: 'none', background: '#fff' }}
        title="HTML preview"
      />
    </div>
  );
}

function JsonTreeView({ content }: { content: string }) {
  const t = useTheme();
  const parsed = useMemo(() => { try { return JSON.parse(content); } catch { return content; } }, [content]);
  return (
    <div style={{ margin: '4px 0', background: t.isDark ? '#ffffff0a' : '#00000008', borderRadius: 6, padding: 8, overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: t.textDim, fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase' }}>JSON</span>
        <CopyButton text={content} />
      </div>
      <TreeNode value={parsed} depth={0} />
    </div>
  );
}

function TreeNode({ label, value, depth }: { label?: string; value: unknown; depth: number }) {
  const t = useTheme();
  const [open, setOpen] = useState(depth < 2);
  const isObj = value !== null && typeof value === 'object';
  const entries = isObj ? (Array.isArray(value) ? value.map((v, i) => [String(i), v] as [string, unknown]) : Object.entries(value as Record<string, unknown>)) : [];

  const style = { fontFamily: "'Geist Mono', monospace", fontSize: 12, lineHeight: 1.6 } as const;

  if (!isObj) {
    const color = typeof value === 'string' ? '#e06c75' : typeof value === 'number' ? '#d19a66' : typeof value === 'boolean' ? '#56b6c2' : t.textMuted;
    return (
      <div style={{ ...style, paddingLeft: depth * 14 }}>
        {label != null && <span style={{ color: t.textSecondary }}>{label}: </span>}
        <span style={{ color }}>{JSON.stringify(value)}</span>
      </div>
    );
  }

  const bracket = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return (
    <div style={{ ...style, paddingLeft: depth * 14 }}>
      <span
        onClick={() => setOpen(!open)}
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2, color: t.textSecondary }}
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {label != null && <span>{label}: </span>}
        <span style={{ color: t.textDim }}>{bracket[0]}{!open && ` ${entries.length} items ${bracket[1]}`}</span>
      </span>
      {open && (
        <>
          {entries.map(([k, v]) => <TreeNode key={k} label={k} value={v} depth={depth + 1} />)}
          <div style={{ paddingLeft: 0, color: t.textDim }}>{bracket[1]}</div>
        </>
      )}
    </div>
  );
}

function YamlBlock({ content }: { content: string }) {
  return <CodeBlock content={content} language="yaml" />;
}

function TableView({ rows }: { rows: string[][] }) {
  const t = useTheme();
  const [header, ...body] = rows;
  return (
    <div style={{ margin: '4px 0', overflow: 'auto', borderRadius: 6, border: `1px solid ${t.borderSubtle}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: "'Geist Mono', monospace" }}>
        <thead>
          <tr style={{ background: t.isDark ? '#ffffff0a' : '#00000008' }}>
            {header.map((h, i) => (
              <th key={i} style={{ padding: '5px 8px', textAlign: 'left', color: t.textSecondary, borderBottom: `1px solid ${t.borderSubtle}`, fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 ? (t.isDark ? '#ffffff05' : '#00000003') : 'transparent' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '4px 8px', color: t.textPrimary, borderBottom: `1px solid ${t.borderSubtle}` }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MermaidRenderer({ content }: { content: string }) {
  const t = useTheme();
  return (
    <div style={{ margin: '4px 0' }}>
      <div style={{ fontSize: 13, color: t.textDim, fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', marginBottom: 4 }}>Mermaid</div>
      <Suspense fallback={<div style={{ padding: 8, fontSize: 12, color: t.textMuted }}>Loading diagram…</div>}>
        <MermaidBlock content={content} />
      </Suspense>
    </div>
  );
}

function MarkdownSegment({ content }: { content: string }) {
  const t = useTheme();
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <span>{children}</span>,
        code: ({ children }) => <code style={{ background: t.isDark ? '#ffffff15' : '#00000015', padding: '2px 4px', borderRadius: '3px' }}>{children}</code>,
        pre: ({ children }) => <pre style={{ background: t.isDark ? '#ffffff15' : '#00000015', padding: '8px', borderRadius: '6px', overflow: 'auto', fontSize: '10px' }}>{children}</pre>,
        strong: ({ children }) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
        em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/* ── Main Component ── */

export function ResponseRenderer({ content }: { content: string }) {
  const segments = useMemo(() => parseSegments(content), [content]);

  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'markdown': return <MarkdownSegment key={i} content={seg.content} />;
          case 'html': return <HtmlPreview key={i} content={seg.content} />;
          case 'code': return <CodeBlock key={i} content={seg.content} language={seg.language} />;
          case 'json': return <JsonTreeView key={i} content={seg.content} />;
          case 'yaml': return <YamlBlock key={i} content={seg.content} />;
          case 'mermaid': return <MermaidRenderer key={i} content={seg.content} />;
          case 'table': return <TableView key={i} rows={seg.rows} />;
        }
      })}
    </>
  );
}
