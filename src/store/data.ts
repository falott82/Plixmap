import { Client, ObjectTypeDefinition } from './types';

export const SEED_CLIENT_ID = 'seed-client-acme';
export const SEED_SITE_ID = 'seed-site-wall-street-01';
export const SEED_PLAN_ID = 'seed-plan-floor-0';
export const SEED_PLAN_IMAGE_URL = '/seed/acme-floor0.svg';

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
              width: 1536,
              height: 1117,
              views: [],
              rooms: [],
              revisions: [],
              objects: []
            }
          ]
        }
      ]
    }
  ];
};

export const defaultObjectTypes: ObjectTypeDefinition[] = [
  { id: 'user', name: { it: 'Utente', en: 'User' }, icon: 'user', builtin: true },
  { id: 'printer', name: { it: 'Stampante', en: 'Printer' }, icon: 'printer', builtin: true },
  { id: 'rack', name: { it: 'Rack rete', en: 'Network rack' }, icon: 'server', builtin: true },
  { id: 'wifi', name: { it: 'Antenna Wi‑Fi', en: 'Wi‑Fi antenna' }, icon: 'wifi', builtin: true },
  { id: 'dect', name: { it: 'Antenna DECT', en: 'DECT antenna' }, icon: 'radio', builtin: true },
  { id: 'tv', name: { it: 'Televisore', en: 'TV' }, icon: 'tv', builtin: true },
  { id: 'desktop', name: { it: 'PC fisso', en: 'Desktop PC' }, icon: 'desktop', builtin: true },
  { id: 'laptop', name: { it: 'Portatile', en: 'Laptop' }, icon: 'laptop', builtin: true },
  { id: 'camera', name: { it: 'Telecamera', en: 'Camera' }, icon: 'camera', builtin: true }
];
