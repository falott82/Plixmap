import { Client, ObjectTypeDefinition } from './types';

export const SEED_CLIENT_ID = 'seed-client-acme';
export const SEED_SITE_ID = 'seed-site-wall-street-01';
export const SEED_PLAN_ID = 'seed-plan-floor-0';
export const SEED_PLAN_IMAGE_URL = '/seed/new-default-plan.png';
export const ALL_ITEMS_LAYER_ID = 'all-items';
export const ALL_ITEMS_LAYER_COLOR = '#e11d48';
export const WALL_LAYER_COLOR = '#fb923c';
export const WIFI_LAYER_COLOR = '#0ea5e9';
export const QUOTE_LAYER_COLOR = '#f97316';
export const DEFAULT_USER_TYPES = ['user', 'real_user', 'generic_user'];
export const DEFAULT_CCTV_TYPES = ['camera'];
export const DEFAULT_RACK_TYPES = ['rack'];
export const DEFAULT_WIFI_TYPES = ['wifi'];
export const DEFAULT_WALL_TYPES = [
  'wall_concrete',
  'wall_drywall_standard',
  'wall_drywall',
  'wall_drywall_heavy',
  'wall_glass_standard',
  'wall_glass_thin',
  'wall_brick',
  'wall_metal',
  'wall_wood',
  'wall_door_wood',
  'wall_door_metal',
  'wall_door_glass',
  'wall_window_single',
  'wall_window_double',
  'wall_window_triple'
];
export const DEFAULT_DESK_TYPES = [
  'desk_round',
  'desk_square',
  'desk_rect',
  'desk_double',
  'desk_long',
  'desk_trap',
  'desk_l',
  'desk_l_rev'
];
export const DEFAULT_DEVICE_TYPES = [
  'badge_door',
  'badge_presence',
  'intercom',
  'video_intercom',
  'router',
  'switch',
  'printer',
  'scanner',
  'dect',
  'tv',
  'microphone',
  'phone',
  'desktop',
  'laptop'
];
export const WALL_TYPE_IDS = DEFAULT_WALL_TYPES;

export const defaultData = (): Client[] => {
  return [
    {
      id: SEED_CLIENT_ID,
      name: 'ACME Inc.',
      shortName: 'ACME',
      address: 'Wall Street 01',
      description: 'Seed workspace',
      logoUrl: undefined,
      layers: [
        { id: ALL_ITEMS_LAYER_ID, name: { it: 'Tutti gli elementi', en: 'All Items' }, color: ALL_ITEMS_LAYER_COLOR, order: 1 },
        { id: 'users', name: { it: 'Utenti', en: 'Users' }, color: '#2563eb', order: 2, typeIds: DEFAULT_USER_TYPES },
        { id: 'devices', name: { it: 'Dispositivi', en: 'Devices' }, color: '#0ea5e9', order: 3, typeIds: DEFAULT_DEVICE_TYPES },
        { id: 'wifi', name: { it: 'WiFi', en: 'WiFi' }, color: WIFI_LAYER_COLOR, order: 4, typeIds: DEFAULT_WIFI_TYPES },
        { id: 'cctv', name: { it: 'CCTV', en: 'CCTV' }, color: '#22c55e', order: 5, typeIds: DEFAULT_CCTV_TYPES },
        { id: 'desks', name: { it: 'Scrivanie', en: 'Desks' }, color: '#8b5cf6', order: 6, typeIds: DEFAULT_DESK_TYPES },
        { id: 'cabling', name: { it: 'Cablaggi', en: 'Cabling' }, color: '#10b981', order: 7 },
        { id: 'walls', name: { it: 'Mura', en: 'Walls' }, color: WALL_LAYER_COLOR, order: 8, typeIds: DEFAULT_WALL_TYPES },
        { id: 'quotes', name: { it: 'Quote', en: 'Quotes' }, color: QUOTE_LAYER_COLOR, order: 9 },
        { id: 'rooms', name: { it: 'Stanze', en: 'Rooms' }, color: '#64748b', order: 10 },
        { id: 'racks', name: { it: 'Rack', en: 'Racks' }, color: '#f97316', order: 11, typeIds: DEFAULT_RACK_TYPES }
      ],
      sites: [
        {
          id: SEED_SITE_ID,
          clientId: SEED_CLIENT_ID,
          name: 'Wall Street 01',
          floorPlans: [
            {
              id: SEED_PLAN_ID,
              siteId: SEED_SITE_ID,
              name: 'Floor 0',
              imageUrl: SEED_PLAN_IMAGE_URL,
              width: 650,
              height: 477,
              views: [
                {
                  id: 'seed-view-default',
                  name: 'DEFAULT',
                  zoom: 1.6,
                  pan: { x: 80, y: 20 },
                  isDefault: true
                }
              ],
              rooms: [],
              revisions: [],
              links: [],
              racks: [],
              rackItems: [],
              rackLinks: [],
              objects: []
            }
          ]
        }
      ]
    }
  ];
};

export const defaultObjectTypes: ObjectTypeDefinition[] = [
  { id: 'user', name: { it: 'Utente generico', en: 'Generic user' }, icon: 'user', builtin: true },
  { id: 'real_user', name: { it: 'Utente reale', en: 'Real user' }, icon: 'userCheck', builtin: true },
  { id: 'camera', name: { it: 'Telecamera', en: 'Camera' }, icon: 'camera', builtin: true },
  { id: 'badge_door', name: { it: 'Apriporta con badge', en: 'Badge door' }, icon: 'lockKeyhole', builtin: true },
  { id: 'badge_presence', name: { it: 'Marcatore presenze badge', en: 'Badge attendance marker' }, icon: 'badgeCheck', builtin: true },
  { id: 'intercom', name: { it: 'Citofono', en: 'Intercom' }, icon: 'intercom', builtin: true },
  { id: 'video_intercom', name: { it: 'Videocitofono', en: 'Video intercom' }, icon: 'videoIntercom', builtin: true },
  { id: 'rack', name: { it: 'Rack rete', en: 'Network rack' }, icon: 'server', builtin: true },
  { id: 'router', name: { it: 'Router', en: 'Router' }, icon: 'router', builtin: true },
  { id: 'switch', name: { it: 'Switch', en: 'Switch' }, icon: 'switch', builtin: true },
  { id: 'printer', name: { it: 'Stampante', en: 'Printer' }, icon: 'printer', builtin: true },
  { id: 'scanner', name: { it: 'Scanner', en: 'Scanner' }, icon: 'scanner', builtin: true },
  { id: 'dect', name: { it: 'Antenna DECT', en: 'DECT antenna' }, icon: 'radio', builtin: true },
  { id: 'tv', name: { it: 'Televisore', en: 'TV' }, icon: 'tv', builtin: true },
  { id: 'microphone', name: { it: 'Microfono', en: 'Microphone' }, icon: 'mic', builtin: true },
  { id: 'phone', name: { it: 'Telefono', en: 'Phone' }, icon: 'phone', builtin: true },
  { id: 'desk_round', name: { it: 'Scrivania tonda', en: 'Round desk' }, icon: 'deskRound', builtin: true },
  { id: 'desk_square', name: { it: 'Scrivania quadrata', en: 'Square desk' }, icon: 'deskSquare', builtin: true },
  { id: 'desk_rect', name: { it: 'Scrivania rettangolare', en: 'Rectangular desk' }, icon: 'deskRect', builtin: true },
  { id: 'desk_double', name: { it: 'Scrivania doppia', en: 'Double desk' }, icon: 'deskDouble', builtin: true },
  { id: 'desk_long', name: { it: 'Banco lungo', en: 'Long bench' }, icon: 'deskLong', builtin: true },
  { id: 'desk_trap', name: { it: 'Scrivania trapezoidale', en: 'Trapezoid desk' }, icon: 'deskTrapezoid', builtin: true },
  { id: 'desk_l', name: { it: 'Scrivania a L', en: 'L-shaped desk' }, icon: 'deskL', builtin: true },
  { id: 'desk_l_rev', name: { it: 'Scrivania a L rovesciata', en: 'Reverse L desk' }, icon: 'deskLReverse', builtin: true },
  // Keep legacy/common types for backward compatibility with existing workspaces
  { id: 'wifi', name: { it: 'Antenna Wi‑Fi', en: 'Wi‑Fi antenna' }, icon: 'wifi', builtin: true },
  { id: 'desktop', name: { it: 'PC fisso', en: 'Desktop PC' }, icon: 'desktop', builtin: true },
  { id: 'laptop', name: { it: 'Portatile', en: 'Laptop' }, icon: 'laptop', builtin: true },
  { id: 'wall_concrete', name: { it: 'Cemento', en: 'Concrete' }, icon: 'cable', builtin: true, attenuationDb: 15, category: 'wall' },
  { id: 'wall_drywall_standard', name: { it: 'Cartongesso (Standard)', en: 'Drywall (Standard)' }, icon: 'cable', builtin: true, attenuationDb: 3, category: 'wall' },
  { id: 'wall_drywall', name: { it: 'Cartongesso', en: 'Drywall' }, icon: 'cable', builtin: true, attenuationDb: 4, category: 'wall' },
  { id: 'wall_drywall_heavy', name: { it: 'Cartongesso (Rinforzato)', en: 'Drywall (Heavy Duty)' }, icon: 'cable', builtin: true, attenuationDb: 4, category: 'wall' },
  { id: 'wall_glass_standard', name: { it: 'Vetro (Standard)', en: 'Glass (Standard)' }, icon: 'cable', builtin: true, attenuationDb: 2, category: 'wall' },
  { id: 'wall_glass_thin', name: { it: 'Vetro (Sottile)', en: 'Glass (Thin)' }, icon: 'cable', builtin: true, attenuationDb: 1, category: 'wall' },
  { id: 'wall_brick', name: { it: 'Mattoni', en: 'Brick' }, icon: 'cable', builtin: true, attenuationDb: 5, category: 'wall' },
  { id: 'wall_metal', name: { it: 'Metallo', en: 'Metal' }, icon: 'cable', builtin: true, attenuationDb: 10, category: 'wall' },
  { id: 'wall_wood', name: { it: 'Legno', en: 'Wood' }, icon: 'cable', builtin: true, attenuationDb: 5, category: 'wall' },
  { id: 'wall_door_wood', name: { it: 'Porta (Legno)', en: 'Door (Wood)' }, icon: 'cable', builtin: true, attenuationDb: 5, category: 'wall' },
  { id: 'wall_door_metal', name: { it: 'Porta (Metallo)', en: 'Door (Metal)' }, icon: 'cable', builtin: true, attenuationDb: 10, category: 'wall' },
  { id: 'wall_door_glass', name: { it: 'Porta (Vetro)', en: 'Door (Glass)' }, icon: 'cable', builtin: true, attenuationDb: 2, category: 'wall' },
  { id: 'wall_window_single', name: { it: 'Finestra (Vetro singolo)', en: 'Window (Single Pane)' }, icon: 'cable', builtin: true, attenuationDb: 4, category: 'wall' },
  { id: 'wall_window_double', name: { it: 'Finestra (Doppio vetro)', en: 'Window (Double Pane)' }, icon: 'cable', builtin: true, attenuationDb: 7, category: 'wall' },
  { id: 'wall_window_triple', name: { it: 'Finestra (Triplo vetro)', en: 'Window (Triple Pane)' }, icon: 'cable', builtin: true, attenuationDb: 10, category: 'wall' }
];
