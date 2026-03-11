#!/usr/bin/env node
/**
 * Post-install script: stub sharp's native module.
 * 
 * @huggingface/transformers depends on sharp for image processing,
 * but modular-studio only uses text embeddings. sharp's native binary
 * fails on many Node versions (especially Node 24+) and platforms.
 * 
 * This script replaces sharp's entry point with a no-op stub.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const sharpIndex = path.join(__dirname, '..', 'node_modules', 'sharp', 'lib', 'index.js');

if (fs.existsSync(sharpIndex)) {
  const stub = [
    "'use strict';",
    '// Stubbed by modular-studio — text embeddings only, no image processing',
    'const noop = () => {};',
    'const chainable = () => new Proxy({}, { get: () => chainable });',
    'module.exports = function sharp() { return chainable(); };',
    'module.exports.default = module.exports;',
    'module.exports.sharp = module.exports;',
    '',
  ].join('\n');
  
  fs.writeFileSync(sharpIndex, stub);
  console.log('[modular-studio] Stubbed sharp (image processing not needed for text embeddings)');
} else {
  // sharp not installed — nothing to do
}
