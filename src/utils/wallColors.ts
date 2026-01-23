import { WALL_LAYER_COLOR } from '../store/data';

export const getWallTypeColor = (typeId?: string | null) => {
  if (!typeId) return WALL_LAYER_COLOR;
  let hash = 0;
  for (let i = 0; i < typeId.length; i += 1) {
    hash = (hash * 31 + typeId.charCodeAt(i)) % 360;
  }
  const hue = Math.abs(hash);
  return `hsl(${hue}, 70%, 55%)`;
};
