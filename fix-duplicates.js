import fs from 'fs';

// Read the file
let content = fs.readFileSync('src/store/mcp-registry.ts', 'utf8');

// Remove duplicate authMethod lines - keep running until no more duplicates
let changed = true;
while (changed) {
  const before = content;
  content = content.replace(/(\s+authMethod: '[^']+',)\s*\n\s*authMethod: '[^']+',/g, '$1');
  changed = before !== content;
}

// Write back
fs.writeFileSync('src/store/mcp-registry.ts', content);

console.log('Fixed duplicate authMethod properties');