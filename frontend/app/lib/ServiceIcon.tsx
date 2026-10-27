import type { IconType } from "react-icons";
import { FaSlack } from "react-icons/fa";
import { FiZap } from "react-icons/fi";
import {
  SiGithub,
  SiGmail,
  SiGooglecalendar,
  SiJira,
  SiNotion,
} from "react-icons/si";

export interface ServiceMeta {
  label: string;
  icon: IconType;
  color: string;
}

export const SERVICE_META: Record<string, ServiceMeta> = {
  notion: { label: "Notion", icon: SiNotion, color: "text-zinc-900 dark:text-white" },
  google: { label: "Google (Gmail & Calendar)", icon: SiGmail, color: "text-[#EA4335]" },
  gmail: { label: "Gmail", icon: SiGmail, color: "text-[#EA4335]" },
  google_calendar: { label: "Google Calendar", icon: SiGooglecalendar, color: "text-[#4285F4]" },
  github: { label: "GitHub", icon: SiGithub, color: "text-zinc-900 dark:text-white" },
  jira: { label: "Jira", icon: SiJira, color: "text-[#2684FF]" },
  slack: { label: "Slack", icon: FaSlack, color: "text-[#E01E5A]" },
};

const FALLBACK: ServiceMeta = {
  label: "Action",
  icon: FiZap,
  color: "text-zinc-500 dark:text-zinc-400",
};

export function getServiceMeta(id?: string): ServiceMeta {
  return (id && SERVICE_META[id]) || { ...FALLBACK, label: id ?? FALLBACK.label };
}

export function ServiceGlyph({ id, className = "h-4 w-4" }: { id?: string; className?: string }) {
  const { icon: Icon, color } = getServiceMeta(id);
  return <Icon className={`${color} ${className}`} aria-hidden="true" />;
}

export function ServiceChip({ id, size = "md" }: { id?: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const glyph = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";
  const tile =
    "grid shrink-0 place-items-center rounded-lg bg-white ring-1 ring-zinc-200 dark:bg-white/5 dark:ring-white/10";

  if (id === "google") {
    return (
      <span className={`${box} ${tile}`}>
        <span className="flex items-center gap-0.5">
          <SiGmail className="h-3 w-3 text-[#EA4335]" aria-hidden="true" />
          <SiGooglecalendar className="h-3 w-3 text-[#4285F4]" aria-hidden="true" />
        </span>
      </span>
    );
  }

  return (
    <span className={`${box} ${tile}`}>
      <ServiceGlyph id={id} className={glyph} />
    </span>
  );
}