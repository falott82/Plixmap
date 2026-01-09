export const DESK_TYPE_IDS = [
  'desk_round',
  'desk_square',
  'desk_rect',
  'desk_double',
  'desk_long',
  'desk_trap',
  'desk_l',
  'desk_l_rev'
] as const;

export const isDeskType = (type: string) => (DESK_TYPE_IDS as readonly string[]).includes(type);
