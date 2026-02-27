import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const CONFIG_DIR = join(homedir(), '.modular-studio');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
const DEFAULT_CONFIG = {
    providers: [],
    mcpServers: [],
};
function ensureDir() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
}
export function readConfig() {
    ensureDir();
    if (!existsSync(CONFIG_PATH)) {
        writeConfig(DEFAULT_CONFIG);
        return { ...DEFAULT_CONFIG };
    }
    try {
        const raw = readFileSync(CONFIG_PATH, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return { ...DEFAULT_CONFIG };
    }
}
export function writeConfig(config) {
    ensureDir();
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
//# sourceMappingURL=config.js.map