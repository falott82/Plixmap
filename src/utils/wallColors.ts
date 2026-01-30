import { WALL_LAYER_COLOR } from '../store/data';

export const getWallTypeColor = (typeId?: string | null) => {
  if (!typeId) return WALL_LAYER_COLOR;
  const lower = typeId.toLowerCase();
  if (lower.includes('glass') || lower.includes('window')) {
    let hash = 0;
    for (let i = 0; i < lower.length; i += 1) {
      hash = (hash * 31 + lower.charCodeAt(i)) % 1000;
    }
    const lightness = 45 + (hash % 25);
    return `hsl(210, 75%, ${lightness}%)`;
  }
  let hash = 0;
  for (let i = 0; i < typeId.length; i += 1) {
    hash = (hash * 31 + typeId.charCodeAt(i)) % 360;
  }
  const hue = Math.abs(hash);
  return `hsl(${hue}, 70%, 55%)`;
};
