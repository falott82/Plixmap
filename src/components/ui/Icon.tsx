import {
  User,
  UserCheck,
  DoorClosed,
  DoorOpen,
  Printer,
  Server,
  Wifi,
  RadioTower,
  Monitor,
  MonitorPlay,
  Laptop,
  Video,
  ScanLine,
  Mic,
  Router,
  SwitchCamera,
  Phone,
  Tablet,
  Shield,
  KeyRound,
  Database,
  Cctv
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
    default:
      return <User {...common} />;
  }
};

export default Icon;
