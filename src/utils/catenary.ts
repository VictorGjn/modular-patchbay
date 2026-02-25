export function getCatenaryPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const dist = Math.hypot(targetX - sourceX, targetY - sourceY);
  const sag = Math.min(dist * 0.25, 100);
  const controlY = midY + sag;
  return `M ${sourceX} ${sourceY} Q ${midX} ${controlY} ${targetX} ${targetY}`;
}
