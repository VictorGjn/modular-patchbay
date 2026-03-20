/**
 * Format a file path for display: parent dir + filename.
 * Full path stays available for tooltips.
 *
 * "c:/Users/victo/Documents/product/00 - Knowledge/Companies/louis-dreyfus.md"
 * → "Companies / louis-dreyfus.md"
 *
 * "src/services/knowledgePipeline.ts"
 * → "services / knowledgePipeline.ts"
 */
export function formatDisplayPath(fullPath: string): string {
  if (!fullPath) return '';
  const normalized = fullPath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? fullPath;
  const fileName = parts[parts.length - 1];
  const parentDir = parts[parts.length - 2];
  return `${parentDir} / ${fileName}`;
}

/**
 * Get just the filename from a path.
 */
export function getFileName(fullPath: string): string {
  if (!fullPath) return '';
  return fullPath.replace(/\\/g, '/').split('/').pop() ?? fullPath;
}
