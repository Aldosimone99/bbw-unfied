import {
  CalendarDays,
  ClipboardList,
  House,
  Settings2,
  UserRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const platformIcons = {
  home: House,
  calendar: CalendarDays,
  bookings: ClipboardList,
  profile: UserRound,
  settings: Settings2
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
