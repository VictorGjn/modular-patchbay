const CABLE_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f1c40f',
  '#e67e22',
  '#9b59b6',
  '#00bcd4',
  '#e91e8a',
  '#ff6b6b',
  '#45b7d1',
] as const;

let colorIndex = 0;

export function getNextCableColor(): string {
  const color = CABLE_COLORS[colorIndex % CABLE_COLORS.length];
  colorIndex++;
  return color;
}

export function resetColorIndex(): void {
  colorIndex = 0;
}

export { CABLE_COLORS };
