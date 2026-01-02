import { Client, ObjectTypeDefinition } from './types';

export const SEED_CLIENT_ID = 'seed-client-acme';
export const SEED_SITE_ID = 'seed-site-wall-street-01';
export const SEED_PLAN_ID = 'seed-plan-floor-0';
export const SEED_PLAN_IMAGE_URL = '/seed/new-default-plan.png';

export const defaultData = (): Client[] => {
  return [
    {
      id: SEED_CLIENT_ID,
      name: 'ACME Inc.',
      shortName: 'ACME',
      address: 'Wall Street 01',
      description: 'Seed workspace',
      logoUrl: undefined,
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
              layers: [
                { id: 'users', name: { it: 'Utenti', en: 'Users' }, color: '#2563eb', order: 1 },
                { id: 'devices', name: { it: 'Dispositivi', en: 'Devices' }, color: '#0ea5e9', order: 2 },
                { id: 'cabling', name: { it: 'Cablaggi', en: 'Cabling' }, color: '#10b981', order: 3 },
                { id: 'rooms', name: { it: 'Stanze', en: 'Rooms' }, color: '#64748b', order: 4 },
                { id: 'racks', name: { it: 'Rack', en: 'Racks' }, color: '#f97316', order: 5 }
              ],
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
  // Keep legacy/common types for backward compatibility with existing workspaces
  { id: 'wifi', name: { it: 'Antenna Wi‑Fi', en: 'Wi‑Fi antenna' }, icon: 'wifi', builtin: true },
  { id: 'desktop', name: { it: 'PC fisso', en: 'Desktop PC' }, icon: 'desktop', builtin: true },
  { id: 'laptop', name: { it: 'Portatile', en: 'Laptop' }, icon: 'laptop', builtin: true }
];
