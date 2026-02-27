#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { startServer } from '../server/index.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
function parseArgs(argv) {
    let port = 4800;
    let open = false;
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--port' && argv[i + 1]) {
            port = parseInt(argv[i + 1], 10);
            i++;
        }
        else if (argv[i] === '--open') {
            open = true;
        }
    }
    return { port, open };
}
async function main() {
    const { port, open } = parseArgs(process.argv);
    // Build frontend if dist/ doesn't exist
    const distPath = join(rootDir, 'dist');
    if (!existsSync(distPath)) {
        console.log('Building frontend...');
        execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
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
//# sourceMappingURL=modular-studio.js.map