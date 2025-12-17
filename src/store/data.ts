import { nanoid } from 'nanoid';
import { Client, FloorPlan, ObjectTypeDefinition } from './types';

const sampleFloorPlan = (siteId: string, name: string, imageUrl: string): FloorPlan => ({
  id: nanoid(),
  siteId,
  name,
  imageUrl,
  width: 1600,
  height: 900,
  views: [],
  objects: [
    {
      id: nanoid(),
      floorPlanId: '',
      type: 'user',
      name: 'Reception',
      description: 'Front desk',
      x: 320,
      y: 220,
      scale: 1
    }
  ]
});

export const defaultData = (): Client[] => {
  const clientId = nanoid();
  const siteId = nanoid();
  const plan = sampleFloorPlan(
    siteId,
    'Piano Terra',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80'
  );
  plan.objects[0].floorPlanId = plan.id;
  return [
    {
      id: clientId,
      name: 'Pippo SRL',
      logoUrl: undefined,
      sites: [
        {
          id: siteId,
          clientId,
          name: 'HQ Via Nave 11',
          floorPlans: [plan]
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
