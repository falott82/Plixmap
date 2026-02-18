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
import { IconName, MapObjectType } from '../../store/types';

interface Props {
  type?: MapObjectType;
  name?: IconName;
  className?: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const Icon = ({ type, name, className, size = 18, color, strokeWidth }: Props) => {
  const common = { size, className, color, strokeWidth };
  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    fill: 'none',
    stroke: color || 'currentColor',
    strokeWidth: strokeWidth ?? 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className
  };
  const resolved: IconName | undefined =
    name ||
    (type === 'user'
      ? 'user'
      : type === 'printer'
        ? 'printer'
        : type === 'rack'
          ? 'server'
          : type === 'wifi'
            ? 'wifi'
            : type === 'dect'
              ? 'radio'
              : type === 'tv'
                ? 'tv'
                : type === 'desktop'
                  ? 'desktop'
                  : type === 'laptop'
                    ? 'laptop'
                    : type === 'camera'
                      ? 'camera'
                      : type === 'badge_door'
                        ? 'lockKeyhole'
                        : type === 'badge_presence'
                          ? 'badgeCheck'
                          : type === 'text'
                      ? 'text'
                        : type === 'image'
                          ? 'image'
                          : type === 'postit'
                            ? 'postit'
                      : undefined);

  switch (resolved) {
    case 'user':
      return <User {...common} />;
    case 'userCheck':
      return <UserCheck {...common} />;
    case 'printer':
      return <Printer {...common} />;
    case 'server':
      return <Server {...common} />;
    case 'wifi':
      return <Wifi {...common} />;
    case 'radio':
      return <RadioTower {...common} />;
    case 'tv':
      return <MonitorPlay {...common} />;
    case 'desktop':
      return <Monitor {...common} />;
    case 'laptop':
      return <Laptop {...common} />;
    case 'camera':
      return <Video {...common} />;
    case 'intercom':
      return <DoorClosed {...common} />;
    case 'videoIntercom':
      return <DoorOpen {...common} />;
    case 'scanner':
      return <ScanLine {...common} />;
    case 'mic':
      return <Mic {...common} />;
    case 'router':
      return <Router {...common} />;
    case 'switch':
      return <SwitchCamera {...common} />;
    case 'phone':
      return <Phone {...common} />;
    case 'tablet':
      return <Tablet {...common} />;
    case 'shield':
      return <Shield {...common} />;
    case 'key':
      return <KeyRound {...common} />;
    case 'database':
      return <Database {...common} />;
    case 'cctv':
      return <Cctv {...common} />;
    case 'lightbulb':
      return <Lightbulb {...common} />;
    case 'plug':
      return <Plug {...common} />;
    case 'plugZap':
      return <PlugZap {...common} />;
    case 'wrench':
      return <Wrench {...common} />;
    case 'cpu':
      return <Cpu {...common} />;
    case 'hardDrive':
      return <HardDrive {...common} />;
    case 'bell':
      return <Bell {...common} />;
    case 'lock':
      return <Lock {...common} />;
    case 'unlock':
      return <Unlock {...common} />;
    case 'thermometer':
      return <Thermometer {...common} />;
    case 'fan':
      return <Fan {...common} />;
    case 'airVent':
      return <AirVent {...common} />;
    case 'wind':
      return <Wind {...common} />;
    case 'snowflake':
      return <Snowflake {...common} />;
    case 'thermometerSnowflake':
      return <ThermometerSnowflake {...common} />;
    case 'thermometerSun':
      return <ThermometerSun {...common} />;
    case 'droplets':
      return <Droplets {...common} />;
    case 'flame':
      return <Flame {...common} />;
    case 'gauge':
      return <Gauge {...common} />;
    case 'power':
      return <Power {...common} />;
    case 'zap':
      return <Zap {...common} />;
    case 'battery':
      return <Battery {...common} />;
    case 'batteryCharging':
      return <BatteryCharging {...common} />;
    case 'batteryFull':
      return <BatteryFull {...common} />;
    case 'batteryLow':
      return <BatteryLow {...common} />;
    case 'network':
      return <Network {...common} />;
    case 'wifiOff':
      return <WifiOff {...common} />;
    case 'cable':
      return <Cable {...common} />;
    case 'wall':
      return (
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
      );
    case 'lockKeyhole':
      return <LockKeyhole {...common} />;
    case 'badgeCheck':
      return <BadgeCheck {...common} />;
    case 'shieldCheck':
      return <ShieldCheck {...common} />;
    case 'shieldAlert':
      return <ShieldAlert {...common} />;
    case 'bellRing':
      return <BellRing {...common} />;
    case 'videoOff':
      return <VideoOff {...common} />;
    case 'micOff':
      return <MicOff {...common} />;
    case 'volume2':
      return <Volume2 {...common} />;
    case 'headphones':
      return <Headphones {...common} />;
    case 'users':
      return <Users {...common} />;
    case 'usersRound':
      return <UsersRound {...common} />;
    case 'assemblyPoint':
      return (
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
      );
    case 'userSearch':
      return <UserSearch {...common} />;
    case 'car':
      return <Car {...common} />;
    case 'truck':
      return <Truck {...common} />;
    case 'bike':
      return <Bike {...common} />;
    case 'bus':
      return <Bus {...common} />;
    case 'train':
      return <TrainFront {...common} />;
    case 'deskRound':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="8.5" r="5.5" />
          <path d="M12 14v6" />
          <path d="M9.5 20h5" />
        </svg>
      );
    case 'deskSquare':
      return (
        <svg {...svgProps}>
          <rect x="4" y="4" width="16" height="10" rx="2" />
          <path d="M12 14v6" />
          <path d="M9.5 20h5" />
        </svg>
      );
    case 'deskRect':
      return (
        <svg {...svgProps}>
          <rect x="3" y="6" width="18" height="8" rx="2" />
          <path d="M12 14v6" />
          <path d="M9 20h6" />
        </svg>
      );
    case 'deskDouble':
      return (
        <svg {...svgProps}>
          <rect x="3" y="5" width="8" height="10" rx="2" />
          <rect x="13" y="5" width="8" height="10" rx="2" />
          <path d="M12 15v5" />
        </svg>
      );
    case 'deskLong':
      return (
        <svg {...svgProps}>
          <rect x="2.5" y="7" width="19" height="6" rx="2" />
          <path d="M6 13v6" />
          <path d="M18 13v6" />
        </svg>
      );
    case 'deskTrapezoid':
      return (
        <svg {...svgProps}>
          <path d="M6 6h12l3 10H3z" />
          <path d="M12 16v4" />
        </svg>
      );
    case 'deskL':
      return (
        <svg {...svgProps}>
          <rect x="4" y="16" width="16" height="4" rx="1" />
          <rect x="4" y="4" width="4" height="16" rx="1" />
        </svg>
      );
    case 'deskLReverse':
      return (
        <svg {...svgProps}>
          <rect x="4" y="16" width="16" height="4" rx="1" />
          <rect x="16" y="4" width="4" height="16" rx="1" />
        </svg>
      );
    case 'text':
      return <TypeIcon {...common} />;
    case 'image':
      return <ImageIcon {...common} />;
    case 'postit':
      return (
        <svg {...svgProps}>
          <rect x="4" y="3" width="16" height="18" rx="2.5" fill="#fde047" stroke="#ca8a04" />
          <path d="M14 3v6h6" fill="#fef08a" stroke="#ca8a04" />
          <path d="M7.5 11h9" stroke="#b45309" strokeWidth={1.6} strokeLinecap="round" />
          <path d="M7.5 14h7.5" stroke="#b45309" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      );
    default:
      return <User {...common} />;
  }
};

export default Icon;
