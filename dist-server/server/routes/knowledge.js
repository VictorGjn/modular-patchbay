import { Router } from 'express';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
const router = Router();
// ── Config ──
const CONFIG_DIR = join(homedir(), '.modular-studio');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
function loadAllowedDirs() {
    try {
        if (existsSync(CONFIG_PATH)) {
            const raw = readFileSync(CONFIG_PATH, 'utf-8');
            const cfg = JSON.parse(raw);
            if (Array.isArray(cfg.allowedDirs) && cfg.allowedDirs.length > 0) {
                return cfg.allowedDirs.map((d) => resolve(d));
            }
        }
    }
    catch {
        // ignore
    }
    return [resolve(homedir())];
}
// ── Security ──
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '__pycache__']);
const SKIP_FILES = new Set(['.env', '.env.local', '.env.production']);
const MAX_DEPTH = 5;
const MAX_FILES = 1000;
const TEXT_EXTENSIONS = new Set([
    '.md', '.txt', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml',
    '.toml', '.py', '.rs', '.go', '.html', '.css', '.scss', '.sh', '.bash',
    '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.xml', '.svg', '.csv', '.sql',
    '.graphql', '.proto', '.env.example', '.gitignore', '.dockerignore',
    '.editorconfig', '.prettierrc', '.eslintrc', '.log', '.cfg', '.ini', '.conf',
]);
function isPathSafe(targetPath, allowedDirs) {
    if (targetPath.includes('..'))
        return false;
    const resolved = resolve(targetPath).toLowerCase();
    return allowedDirs.some((dir) => resolved.startsWith(dir.toLowerCase()));
}
function isTextFile(ext) {
    return TEXT_EXTENSIONS.has(ext.toLowerCase());
}
// ── Classification ──
function classifyKnowledgeType(filePath) {
    const p = filePath.toLowerCase();
    const name = basename(p);
    if (name.startsWith('readme') || name.startsWith('spec') || name.startsWith('design'))
        return 'framework';
    if (name.startsWith('changelog') || p.endsWith('.log'))
        return 'signal';
    const ext = extname(p);
    if (ext === '.md' && p.includes('docs'))
        return 'ground-truth';
    if (['.ts', '.tsx', '.py'].includes(ext))
        return 'evidence';
    return 'evidence';
}
// ── Scanner ──
function scanDirectory(dirPath, basePath, depth, counter) {
    if (depth > MAX_DEPTH || counter.count >= MAX_FILES)
        return [];
    let entries;
    try {
        entries = readdirSync(dirPath, { withFileTypes: true });
    }
    catch {
        return [];
    }
    const nodes = [];
    for (const entry of entries) {
        if (counter.count >= MAX_FILES)
            break;
        const fullPath = join(dirPath, entry.name);
        const relPath = relative(basePath, fullPath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.'))
                continue;
            const children = scanDirectory(fullPath, basePath, depth + 1, counter);
            nodes.push({ name: entry.name, path: relPath, type: 'directory', children });
        }
        else if (entry.isFile()) {
            if (SKIP_FILES.has(entry.name))
                continue;
            counter.count++;
            const ext = extname(entry.name);
            try {
                const stat = statSync(fullPath);
                const node = {
                    name: entry.name,
                    path: relPath,
                    type: 'file',
                    size: stat.size,
                    extension: ext || undefined,
                };
                if (isTextFile(ext)) {
                    node.tokenEstimate = Math.ceil(stat.size / 4);
                }
                nodes.push(node);
            }
            catch {
                // skip inaccessible files
            }
        }
    }
    return nodes;
}
// ── Routes ──
router.get('/scan', (req, res) => {
    const dir = req.query.dir;
    if (!dir) {
        const resp = { status: 'error', error: 'Missing required query parameter: dir' };
        res.status(400).json(resp);
        return;
    }
    const resolved = resolve(dir);
    const allowedDirs = loadAllowedDirs();
    if (!isPathSafe(resolved, allowedDirs)) {
        const resp = { status: 'error', error: 'Directory not in allowlist' };
        res.status(403).json(resp);
        return;
    }
    if (!existsSync(resolved)) {
        const resp = { status: 'error', error: 'Directory does not exist' };
        res.status(404).json(resp);
        return;
    }
    const counter = { count: 0 };
    const tree = scanDirectory(resolved, resolved, 0, counter);
    const resp = { status: 'ok', data: tree };
    res.json(resp);
});
router.get('/read', (req, res) => {
    const filePath = req.query.path;
    if (!filePath) {
        const resp = { status: 'error', error: 'Missing required query parameter: path' };
        res.status(400).json(resp);
        return;
    }
    const resolved = resolve(filePath);
    const allowedDirs = loadAllowedDirs();
    if (!isPathSafe(resolved, allowedDirs)) {
        const resp = { status: 'error', error: 'File not in allowlist' };
        res.status(403).json(resp);
        return;
    }
    if (!existsSync(resolved)) {
        const resp = { status: 'error', error: 'File does not exist' };
        res.status(404).json(resp);
        return;
    }
    try {
        const stat = statSync(resolved);
        if (!stat.isFile()) {
            const resp = { status: 'error', error: 'Path is not a file' };
            res.status(400).json(resp);
            return;
        }
        // Limit file size to 1MB
        if (stat.size > 1_048_576) {
            const resp = { status: 'error', error: 'File too large (max 1MB)' };
            res.status(413).json(resp);
            return;
        }
        const ext = extname(resolved);
        const content = readFileSync(resolved, 'utf-8');
        const tokenEstimate = Math.ceil(stat.size / 4);
        const knowledgeType = classifyKnowledgeType(resolved);
        const data = {
            path: resolved.replace(/\\/g, '/'),
            content,
            size: stat.size,
            extension: ext,
            tokenEstimate,
            knowledgeType,
        };
        const resp = { status: 'ok', data };
        res.json(resp);
    }
    catch {
        const resp = { status: 'error', error: 'Failed to read file' };
        res.status(500).json(resp);
    }
});
router.get('/allowed-dirs', (_req, res) => {
    const dirs = loadAllowedDirs();
    const resp = { status: 'ok', data: dirs };
    res.json(resp);
});
export default router;
//# sourceMappingURL=knowledge.js.map