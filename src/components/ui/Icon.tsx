import {
  AirVent,
  Battery,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BadgeCheck,
  Bell,
  BellRing,
  Bike,
  Bus,
  Cable,
  Car,
  Cctv,
  Cpu,
  Database,
  DoorClosed,
  DoorOpen,
  Droplets,
  Fan,
  Flame,
  Gauge,
  HardDrive,
  Headphones,
  Image as ImageIcon,
  KeyRound,
  Laptop,
  Lightbulb,
  Lock,
  LockKeyhole,
  Mic,
  MicOff,
  Monitor,
  MonitorPlay,
  Network,
  Phone,
  Plug,
  PlugZap,
  Power,
  Printer,
  RadioTower,
  Router,
  ScanLine,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  SwitchCamera,
  Tablet,
  Thermometer,
  ThermometerSnowflake,
  ThermometerSun,
  TrainFront,
  Truck,
  Type as TypeIcon,
  Unlock,
  User,
  UserCheck,
  UserSearch,
  Users,
  UsersRound,
  Video,
  VideoOff,
  Volume2,
  Wifi,
  WifiOff,
  Wind,
  Wrench,
  Zap
} from 'lucide-react';
import type { ComponentType, ReactElement } from 'react';
import { IconName, MapObjectType } from '../../store/types';

interface Props {
  type?: MapObjectType;
  name?: IconName;
  className?: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

type LucideIcon = ComponentType<{ size?: number; className?: string; color?: string; strokeWidth?: number }>;

/** IconName → lucide component. Custom (hand-drawn) icons live in CUSTOM_ICONS below. */
const LUCIDE_ICONS: Partial<Record<IconName, LucideIcon>> = {
  user: User,
  userCheck: UserCheck,
  printer: Printer,
  server: Server,
  wifi: Wifi,
  radio: RadioTower,
  tv: MonitorPlay,
  desktop: Monitor,
  laptop: Laptop,
  camera: Video,
  intercom: DoorClosed,
  videoIntercom: DoorOpen,
  scanner: ScanLine,
  mic: Mic,
  router: Router,
  switch: SwitchCamera,
  phone: Phone,
  tablet: Tablet,
  shield: Shield,
  key: KeyRound,
  database: Database,
  cctv: Cctv,
  lightbulb: Lightbulb,
  plug: Plug,
  plugZap: PlugZap,
  wrench: Wrench,
  cpu: Cpu,
  hardDrive: HardDrive,
  bell: Bell,
  lock: Lock,
  unlock: Unlock,
  thermometer: Thermometer,
  fan: Fan,
  airVent: AirVent,
  wind: Wind,
  snowflake: Snowflake,
  thermometerSnowflake: ThermometerSnowflake,
  thermometerSun: ThermometerSun,
  droplets: Droplets,
  flame: Flame,
  gauge: Gauge,
  power: Power,
  zap: Zap,
  battery: Battery,
  batteryCharging: BatteryCharging,
  batteryFull: BatteryFull,
  batteryLow: BatteryLow,
  network: Network,
  wifiOff: WifiOff,
  cable: Cable,
  lockKeyhole: LockKeyhole,
  badgeCheck: BadgeCheck,
  shieldCheck: ShieldCheck,
  shieldAlert: ShieldAlert,
  bellRing: BellRing,
  videoOff: VideoOff,
  micOff: MicOff,
  volume2: Volume2,
  headphones: Headphones,
  users: Users,
  usersRound: UsersRound,
  userSearch: UserSearch,
  car: Car,
  truck: Truck,
  bike: Bike,
  bus: Bus,
  train: TrainFront,
  text: TypeIcon,
  image: ImageIcon
};

/** Default icon for a map object type when no explicit icon name is given. */
const TYPE_DEFAULT_ICON: Partial<Record<MapObjectType, IconName>> = {
  user: 'user',
  printer: 'printer',
  rack: 'server',
  wifi: 'wifi',
  dect: 'radio',
  tv: 'tv',
  desktop: 'desktop',
  laptop: 'laptop',
  camera: 'camera',
  badge_door: 'lockKeyhole',
  badge_presence: 'badgeCheck',
  text: 'text',
  image: 'image',
  postit: 'postit'
};

type SvgProps = {
  width: number; height: number; viewBox: string; xmlns: string; fill: string; stroke: string; strokeWidth: number;
  strokeLinecap: 'round'; strokeLinejoin: 'round'; className?: string;
};

const CUSTOM_ICONS: Partial<Record<IconName, (svgProps: SvgProps) => ReactElement>> = {
  wall: (svgProps) => (
    <svg {...svgProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M3 15h18" />
      <path d="M9 5v5" />
      <path d="M15 5v5" />
      <path d="M6 10v5" />
      <path d="M12 10v5" />
      <path d="M18 10v5" />
      <path d="M9 15v4" />
      <path d="M15 15v4" />
    </svg>
  ),
  assemblyPoint: (svgProps) => (
    <svg {...svgProps} fill="none" stroke="none">
      <rect x="1" y="1" width="22" height="22" rx="2" fill="#ffffff" stroke="#111827" strokeWidth={1} />
      <rect x="2.2" y="2.2" width="19.6" height="19.6" rx="1.5" fill="#099b2b" />
      <path d="M3.8 5.5h3.2v1.4h2.1v2.1H7v1.4H3.8l2.9-2.9z" fill="#ffffff" />
      <path d="M20.2 5.5H17v1.4h-2.1v2.1H17v1.4h3.2l-2.9-2.9z" fill="#ffffff" />
      <path d="M3.8 18.5h3.2v-1.4h2.1V15H7v-1.4H3.8l2.9 2.9z" fill="#ffffff" />
      <path d="M20.2 18.5H17v-1.4h-2.1V15H17v-1.4h3.2l-2.9 2.9z" fill="#ffffff" />
      <circle cx="12" cy="9.8" r="1.3" fill="#ffffff" />
      <circle cx="9.1" cy="11.6" r="1.1" fill="#ffffff" />
      <circle cx="14.9" cy="11.6" r="1.1" fill="#ffffff" />
      <circle cx="12" cy="13.3" r="1.1" fill="#ffffff" />
      <rect x="10.6" y="14.3" width="2.8" height="4.2" rx="0.9" fill="#ffffff" />
      <rect x="7.5" y="13.9" width="2.3" height="3.8" rx="0.8" fill="#ffffff" />
      <rect x="14.2" y="13.9" width="2.3" height="3.8" rx="0.8" fill="#ffffff" />
    </svg>
  ),
  deskRound: (svgProps) => (
    <svg {...svgProps}>
      <circle cx="12" cy="8.5" r="5.5" />
      <path d="M12 14v6" />
      <path d="M9.5 20h5" />
    </svg>
  ),
  deskSquare: (svgProps) => (
    <svg {...svgProps}>
      <rect x="4" y="4" width="16" height="10" rx="2" />
      <path d="M12 14v6" />
      <path d="M9.5 20h5" />
    </svg>
  ),
  deskRect: (svgProps) => (
    <svg {...svgProps}>
      <rect x="3" y="6" width="18" height="8" rx="2" />
      <path d="M12 14v6" />
      <path d="M9 20h6" />
    </svg>
  ),
  deskDouble: (svgProps) => (
    <svg {...svgProps}>
      <rect x="3" y="5" width="8" height="10" rx="2" />
      <rect x="13" y="5" width="8" height="10" rx="2" />
      <path d="M12 15v5" />
    </svg>
  ),
  deskLong: (svgProps) => (
    <svg {...svgProps}>
      <rect x="2.5" y="7" width="19" height="6" rx="2" />
      <path d="M6 13v6" />
      <path d="M18 13v6" />
    </svg>
  ),
  deskTrapezoid: (svgProps) => (
    <svg {...svgProps}>
      <path d="M6 6h12l3 10H3z" />
      <path d="M12 16v4" />
    </svg>
  ),
  deskL: (svgProps) => (
    <svg {...svgProps}>
      <rect x="4" y="16" width="16" height="4" rx="1" />
      <rect x="4" y="4" width="4" height="16" rx="1" />
    </svg>
  ),
  deskLReverse: (svgProps) => (
    <svg {...svgProps}>
      <rect x="4" y="16" width="16" height="4" rx="1" />
      <rect x="16" y="4" width="4" height="16" rx="1" />
    </svg>
  ),
  postit: (svgProps) => (
    <svg {...svgProps}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" fill="#fde047" stroke="#ca8a04" />
      <path d="M14 3v6h6" fill="#fef08a" stroke="#ca8a04" />
      <path d="M7.5 11h9" stroke="#b45309" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M7.5 14h7.5" stroke="#b45309" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  )
};

const Icon = ({ type, name, className, size = 18, color, strokeWidth }: Props) => {
  const resolved: IconName | undefined = name || (type ? TYPE_DEFAULT_ICON[type] : undefined);
  const custom = resolved ? CUSTOM_ICONS[resolved] : undefined;
  if (custom) {
    return custom({
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      xmlns: 'http://www.w3.org/2000/svg',
      fill: 'none',
      stroke: color || 'currentColor',
      strokeWidth: strokeWidth ?? 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className
    });
  }
  const Lucide = (resolved && LUCIDE_ICONS[resolved]) || User;
  return <Lucide size={size} className={className} color={color} strokeWidth={strokeWidth} />;
};

export default Icon;
