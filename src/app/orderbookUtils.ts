// src/app/orderbookUtils.ts
export function detectPressureZones(levels: { quantity: number }[]) {
  const qtys = levels.map(l => l.quantity);
  if (!qtys.length) return [];
  const mean = qtys.reduce((a, b) => a + b, 0) / qtys.length;
  const std = Math.sqrt(qtys.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / qtys.length);
  const threshold = mean + 1.2 * std;
  // Mark as pressure if quantity > threshold
  return qtys.map(q => q > threshold);
}