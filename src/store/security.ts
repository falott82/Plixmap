import { IconName, ObjectTypeDefinition } from './types';

export const SECURITY_LAYER_ID = 'security';

export type SecurityTypeSeed = {
  id: string;
  name: { it: string; en: string };
  icon: IconName;
  emergencyPoint?: boolean;
};

export const SECURITY_TYPE_SEEDS: SecurityTypeSeed[] = [
  { id: 'safety_extinguisher', name: { it: 'Estintore', en: 'Fire extinguisher' }, icon: 'flame' },
  { id: 'safety_extinguisher_trolley', name: { it: 'Estintore carrellato', en: 'Trolley extinguisher' }, icon: 'truck' },
  { id: 'safety_fire_alarm_button', name: { it: 'Pulsante allarme antincendio', en: 'Fire alarm button' }, icon: 'bellRing' },
  { id: 'safety_first_aid_box', name: { it: 'Cassetta medica', en: 'First aid box' }, icon: 'shieldCheck' },
  { id: 'safety_defibrillator', name: { it: 'DAE', en: 'Defibrillator' }, icon: 'batteryCharging' },
  { id: 'safety_assembly_point', name: { it: 'Punto di raccolta', en: 'Assembly point' }, icon: 'usersRound', emergencyPoint: true },
  { id: 'safety_siren', name: { it: 'Sirena', en: 'Siren' }, icon: 'volume2' },
  { id: 'safety_hydrant', name: { it: 'Idrante', en: 'Hydrant' }, icon: 'droplets' },
  { id: 'safety_smoke_detector', name: { it: 'Rilevatore fumo', en: 'Smoke detector' }, icon: 'wind' },
  { id: 'safety_heat_detector', name: { it: 'Rilevatore calore', en: 'Heat detector' }, icon: 'thermometerSun' },
  { id: 'safety_gas_detector', name: { it: 'Rilevatore gas', en: 'Gas detector' }, icon: 'gauge' },
  { id: 'safety_sprinkler_water', name: { it: 'Sprinkler acqua', en: 'Water sprinkler' }, icon: 'network' },
  { id: 'safety_sprinkler_gas', name: { it: 'Sprinkler gas', en: 'Gas sprinkler' }, icon: 'airVent' },
  { id: 'safety_sprinkler_water_mist', name: { it: "Sprinkler nebbia d'acqua", en: 'Water mist sprinkler' }, icon: 'snowflake' },
  { id: 'safety_sprinkler_foam', name: { it: 'Sprinkler schiuma antincendio', en: 'Foam sprinkler' }, icon: 'fan' },
  { id: 'safety_sprinkler_powder', name: { it: 'Sprinkler polvere antincendio', en: 'Powder sprinkler' }, icon: 'thermometer' },
  { id: 'safety_emergency_power_cut', name: { it: 'Quadro sgancio elettrico emergenza', en: 'Emergency power cut panel' }, icon: 'power' },
  { id: 'safety_gas_valve', name: { it: 'Valvola intercettazione gas', en: 'Gas shutoff valve' }, icon: 'key' },
  { id: 'safety_emergency_shower', name: { it: 'Doccia di emergenza', en: 'Emergency shower' }, icon: 'plugZap' },
  { id: 'safety_eye_wash', name: { it: 'Lavaocchi', en: 'Eye wash station' }, icon: 'userSearch' },
  {
    id: 'safety_chemical_spill_kit',
    name: { it: 'Kit antiversamento sostanze chimiche', en: 'Chemical spill kit' },
    icon: 'shield'
  },
  {
    id: 'safety_infirmary',
    name: { it: 'Infermeria / punto primo soccorso', en: 'Infirmary / first aid point' },
    icon: 'userCheck',
    emergencyPoint: true
  },
  { id: 'safety_fire_blanket', name: { it: 'Coperta antifiamma', en: 'Fire blanket' }, icon: 'lock' },
  { id: 'safety_main_water_valve', name: { it: 'Valvole acqua principali', en: 'Main water valves' }, icon: 'wrench' }
];

export const SECURITY_TYPE_IDS = SECURITY_TYPE_SEEDS.map((entry) => entry.id);
export const SECURITY_TYPE_ID_SET = new Set(SECURITY_TYPE_IDS);
export const SECURITY_EMERGENCY_POINT_TYPE_IDS = SECURITY_TYPE_SEEDS.filter((entry) => entry.emergencyPoint).map((entry) => entry.id);
export const SECURITY_EMERGENCY_POINT_TYPE_ID_SET = new Set(SECURITY_EMERGENCY_POINT_TYPE_IDS);

export const isSecurityTypeId = (typeId: string | undefined | null) => SECURITY_TYPE_ID_SET.has(String(typeId || ''));

export const asSecurityObjectTypes = (): ObjectTypeDefinition[] =>
  SECURITY_TYPE_SEEDS.map((entry) => ({
    id: entry.id,
    name: entry.name,
    icon: entry.icon,
    builtin: true
  }));
