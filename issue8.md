## Problem

After the code-aware indexer (`codeIndexer.ts`) is implemented, it needs to be wired into the knowledge pipeline. Currently the system only uses `indexMarkdown()` for all files:

- TypeScript/Python files still get basic markdown-style indexing
- Code structure (exports, types, functions) isn't shown in the UI
- No integration between code indexer and tree index store
- LocalFilesPanel doesn't display code-specific structure

## Proposed Solution

Wire the code indexer into the existing knowledge pipeline with conditional dispatch:

1. **Smart Routing**: Update `treeIndexStore` to call `indexSource()` instead of `indexMarkdown()`
2. **File Type Detection**: Route `.ts/.tsx/.js/.py` files to code indexer, others to markdown
3. **UI Integration**: Show code structure as expandable tree nodes in LocalFilesPanel
4. **Structure Display**: Display exports, types, functions as collapsible hierarchy

## Types & Interfaces

Integration with existing:
```typescript
// From treeIndexStore
interface TreeIndex {
  nodes: TreeNode[];
  totalTokens: number;
  metadata?: Record<string, any>;
}

// From codeIndexer.ts (to be created)
interface CodeStructure {
  exports: Export[];
  types: TypeDefinition[];
  functions: FunctionSignature[];
  classes: ClassDefinition[];
}
```

New tree node types:
```typescript
interface CodeTreeNode extends TreeNode {
  nodeType: 'export' | 'type' | 'function' | 'class' | 'module';
  signature?: string;
  location?: { line: number; column: number };
}
```

## Behaviors

1. **File Type Routing**: Check file extension → route to appropriate indexer
2. **Code Structure Display**: Show exports, types, functions as expandable nodes
3. **Depth Awareness**: Code indexer respects depth settings for appropriate detail level
4. **Tree Integration**: Code structure integrates seamlessly with existing tree UI
5. **Fallback Handling**: Fall back to markdown indexing if code parsing fails

## Edge Cases

- Handle mixed directories with both code and markdown files
- Graceful fallback when code indexer fails to parse
- Handle very large codebases without UI performance issues  
- Support files with mixed content (code + markdown comments)
- Handle file renames/moves that affect existing indexes
- Preserve existing tree indexes for non-code files

## Acceptance Criteria

- [ ] `treeIndexStore.indexFiles()` dispatches to appropriate indexer by file type
- [ ] `.ts/.tsx/.js/.py` files show structured code tree in LocalFilesPanel
- [ ] Code structure displays as expandable nodes (exports → types → functions)
- [ ] Existing markdown file indexing continues to work unchanged
- [ ] Code tree nodes show signatures and location information
- [ ] Depth levels appropriately filter code structure complexity
- [ ] Performance remains acceptable with large codebases
- [ ] Mixed file type directories display both code and markdown structures

## Files to Modify

- `src/store/treeIndexStore.ts` - Update indexing dispatch logic
- `src/panels/knowledge/LocalFilesPanel.tsx` - Enhance tree display for code structure  
- Wire integration with `src/utils/codeIndexer.ts` (created in issue #44)
- Add file type detection utility function
- Enhance TreeNode rendering to handle code-specific node types

## Estimate

**Medium (M)** - Integration work requiring store updates and UI enhancements, depends on codeIndexer.ts completion