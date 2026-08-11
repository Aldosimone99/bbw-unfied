import {
  BarChart3,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  House,
  History,
  MessageSquare,
  Send,
  Settings2,
  ShieldCheck,
  UserRound,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const platformIcons = {
  home: House,
  calendar: CalendarDays,
  availability: CalendarRange,
  bookings: ClipboardList,
  catalog: ClipboardList,
  clients: Users,
  consents: ShieldCheck,
  history: History,
  invites: Send,
  members: Users,
  messages: MessageSquare,
  profile: UserRound,
  reports: BarChart3,
  settings: Settings2,
  staff: Building2
} satisfies Record<string, LucideIcon>;

export type PlatformIconName = keyof typeof platformIcons;

type PlatformIconProps = {
  name: PlatformIconName;
  className?: string;
  size?: number;
};

export default function PlatformIcon({ name, className, size = 18 }: PlatformIconProps) {
  const Icon = platformIcons[name];

  return (
    <Icon
      className={className}
      size={size}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    />
  );
}
