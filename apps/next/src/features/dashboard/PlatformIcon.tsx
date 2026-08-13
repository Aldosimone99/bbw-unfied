import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ClipboardList,
  ClipboardPlus,
  FileSignature,
  House,
  History,
  MessageSquare,
  MoreHorizontal,
  Search,
  Send,
  Settings2,
  Stethoscope,
  TriangleAlert,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const platformIcons = {
  arrowRight: ArrowRight,
  home: House,
  dashboard: House,
  calendar: CalendarDays,
  appointments: CalendarClock,
  availability: CalendarRange,
  bookings: ClipboardList,
  catalog: ClipboardPlus,
  check: Check,
  chevronDown: ChevronDown,
  chevronsUpDown: ChevronsUpDown,
  treatments: ClipboardPlus,
  clients: UsersRound,
  consents: FileSignature,
  history: History,
  invites: Send,
  members: UsersRound,
  professionals: Stethoscope,
  messages: MessageSquare,
  moreActions: MoreHorizontal,
  organization: Building2,
  search: Search,
  profile: UserRound,
  reports: BarChart3,
  settings: Settings2,
  staff: Stethoscope,
  attention: TriangleAlert,
  success: BadgeCheck,
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
