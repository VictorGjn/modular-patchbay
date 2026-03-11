/**
 * Path Security Utilities
 * 
 * Shared utilities for validating file paths across the application
 */

import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.modular-studio');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

interface KnowledgeConfig {
  allowedDirs?: string[];
}

/**
 * Load allowed directories from configuration
 */
export function loadAllowedDirs(): string[] {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw) as KnowledgeConfig;
      if (Array.isArray(cfg.allowedDirs) && cfg.allowedDirs.length > 0) {
        return cfg.allowedDirs.map((d) => resolve(d));
      }
    }
  } catch {
    // ignore
  }
  // Default: current working directory + user home directory
  return [resolve(process.cwd()), resolve(homedir())];
}

/**
 * Check if a target path is safe to access
 * 
 * @param targetPath Path to validate
 * @param allowedDirs Array of allowed parent directories 
 * @returns true if path is safe, false otherwise
 */
export function isPathSafe(targetPath: string, allowedDirs: string[]): boolean {
  // Reject path traversal attempts
  if (targetPath.includes('..')) return false;
  
  // SECURITY FIX: Reject null byte attacks
  if (targetPath.includes('\0')) return false;
  
  // Resolve to absolute path and normalize case for comparison
  const resolved = resolve(targetPath).toLowerCase();
  
  // Check if path starts with any allowed directory
  return allowedDirs.some((dir) => resolved.startsWith(dir.toLowerCase()));
}

/**
 * Validate a file path and throw an error if not safe
 * 
 * @param filePath Path to validate
 * @param allowedDirs Optional array of allowed directories (loads from config if not provided)
 * @throws Error if path is not safe
 */
export function validateFilePath(filePath: string, allowedDirs?: string[]): void {
  const dirs = allowedDirs ?? loadAllowedDirs();
  
  if (!isPathSafe(filePath, dirs)) {
    throw new Error(`Access denied: path outside allowed directories`);
  }
}

/**
 * Validate multiple file paths
 * 
 * @param filePaths Array of paths to validate
 * @param allowedDirs Optional array of allowed directories (loads from config if not provided)
 * @throws Error if any path is not safe
 */
export function validateFilePaths(filePaths: string[], allowedDirs?: string[]): void {
  const dirs = allowedDirs ?? loadAllowedDirs();
  
  for (const filePath of filePaths) {
    if (!isPathSafe(filePath, dirs)) {
      throw new Error(`Access denied: path outside allowed directories: ${filePath}`);
    }
  }
}