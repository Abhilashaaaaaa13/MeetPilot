export type ActionBlock = {
  service?: string;
  action?: string;
  title?: string;
  args?: Record<string, unknown>;
  source?: string;
  missing?: string[];
  status?: string;
};

export type ActionItem = { raw: string; data: ActionBlock | null };

/** One action the user approved from the list. */
export type BatchAction = {
  service?: string;
  action?: string;
  title?: string;
  args: Record<string, unknown>;
};

/** Runs the approved actions and returns, per action, whether it succeeded. */
export type BatchHandler = (actions: BatchAction[]) => Promise<boolean[]>;

export const TONES = {
  indigo: { rail: "bg-indigo-500", dot: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-300" },
  amber: { rail: "bg-amber-500", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  red: { rail: "bg-red-500", dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  emerald: { rail: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
} as const;

/* ---------- remembered field values (e.g. a Notion database id) ---------- */

const fieldKey = (service: string | undefined, field: string) =>
  `meetpilot:field:${service ?? "any"}:${field}`;

export function readRemembered(service: string | undefined, fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === "undefined") return out;
  for (const field of fields) {
    try {
      const value = localStorage.getItem(fieldKey(service, field));
      if (value) out[field] = value;
    } catch {
      // storage unavailable
    }
  }
  return out;
}

export function remember(service: string | undefined, values: Record<string, string>) {
  for (const [field, value] of Object.entries(values)) {
    try {
      localStorage.setItem(fieldKey(service, field), value);
    } catch {
      // storage unavailable
    }
  }
}

/** Pulls an owner name out of "[Name] ..." in `source`, or "Owner: Name" in the content. */
export function getOwner(block: ActionBlock): string | null {
  const fromSource = block.source?.match(/^\[([^\]]+)\]/);
  if (fromSource) return fromSource[1];
  const content = typeof block.args?.content === "string" ? block.args.content : "";
  const fromContent = content.match(/Owner:\s*([^.\n]+)/);
  return fromContent ? fromContent[1].trim() : null;
}