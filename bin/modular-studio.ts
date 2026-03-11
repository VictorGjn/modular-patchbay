#!/usr/bin/env node

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error('modular-studio requires Node.js 18 or higher. You are running Node.js ' + process.versions.node);
  process.exit(1);
}

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { startServer } from '../server/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// In dev: bin/ is 1 level deep. In published: dist-server/bin/ is 2 levels deep.
// Detect by checking if we're inside dist-server/
const rootDir = __dirname.includes('dist-server') ? join(__dirname, '..', '..') : join(__dirname, '..');

function showHelp() {
  console.log(`
modular-studio — Context engineering IDE for AI agents

Usage:
  modular-studio [options]

Options:
  --port <number>  Port to listen on (default: 4800)
  --open           Open browser automatically
  --help, -h       Show this help message
  --version, -v    Show version
`);
}

function parseArgs(argv: string[]): { port: number; open: boolean } {
  let port = 4800;
  let open = false;

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') {
      showHelp();
      process.exit(0);
    } else if (argv[i] === '--version' || argv[i] === '-v') {
      const pkgPath = join(rootDir, 'package.json');
      const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : { version: 'unknown' };
      console.log(`modular-studio v${pkg.version}`);
      process.exit(0);
    } else if (argv[i] === '--port' && argv[i + 1]) {
      port = parseInt(argv[i + 1], 10);
      i++;
    } else if (argv[i] === '--open') {
      open = true;
    }
  }

  return { port, open };
}

async function main() {
  const { port, open } = parseArgs(process.argv);

  // Verify frontend build exists
  const distPath = join(rootDir, 'dist');
  if (!existsSync(distPath)) {
    // In dev mode, try building
    const tsconfigPath = join(rootDir, 'tsconfig.json');
    if (existsSync(tsconfigPath)) {
      console.log('Building frontend...');
      execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
    } else {
      console.error('Error: Frontend build not found at', distPath);
      console.error('If installed via npm, try reinstalling: npm install -g modular-studio');
      process.exit(1);
    }
  }

  startServer(port);

  if (open) {
    const { default: openBrowser } = await import('open');
    await openBrowser(`http://localhost:${port}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
