"use client";

import { useMemo, useState } from "react";
import { FiCheck, FiChevronDown, FiInfo } from "react-icons/fi";
// If your file is named ServiceIcon.tsx, change this path to "../lib/ServiceIcon"
import { ServiceChip, getServiceMeta } from "../lib/ServiceIcon";
import {
  TONES,
  getOwner,
  readRemembered,
  remember,
  type ActionBlock,
  type ActionItem,
  type BatchHandler,
} from "../lib/Action";

interface ActionListProps {
  items: ActionItem[];
  onBatch: BatchHandler;
  locked: boolean;
}

type RequiredField = { key: string; service?: string; field: string; count: number };

const keyOf = (block: ActionBlock, field: string) => `${block.service ?? "any"}:${field}`;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  return JSON.stringify(value);
}

export default function ActionList({ items, onBatch, locked }: ActionListProps) {
  // Every distinct missing field across the set (e.g. notion:database_id), with how many actions need it
  const fields = useMemo<RequiredField[]>(() => {
    const map = new Map<string, RequiredField>();
    for (const { data } of items) {
      if (!data || data.status === "needs_connection") continue;
      for (const field of data.missing ?? []) {
        const key = keyOf(data, field);
        const existing = map.get(key);
        if (existing) existing.count += 1;
        else map.set(key, { key, service: data.service, field, count: 1 });
      }
    }
    return [...map.values()];
  }, [items]);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of fields) {
      const saved = readRemembered(f.service, [f.field])[f.field];
      if (saved) out[f.key] = saved;
    }
    return out;
  });
  const [deselected, setDeselected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [sent, setSent] = useState<Set<number>>(new Set());
  const [running, setRunning] = useState(false);

  const isResolved = (block: ActionBlock) =>
    (block.missing ?? []).every((field) => (values[keyOf(block, field)] ?? "").trim());

  const rowKind = (i: number): "sent" | "connect" | "needs" | "ready" | "invalid" => {
    const block = items[i].data;
    if (!block) return "invalid";
    if (sent.has(i)) return "sent";
    if (block.status === "needs_connection") return "connect";
    if (!isResolved(block)) return "needs";
    return "ready";
  };

  const indices = items.map((_, i) => i);
  const approvable = indices.filter((i) => rowKind(i) === "ready");
  const selected = approvable.filter((i) => !deselected.has(i));
  const counts = {
    ready: approvable.length,
    needs: indices.filter((i) => rowKind(i) === "needs").length,
    connect: indices.filter((i) => rowKind(i) === "connect").length,
    sent: sent.size,
  };

  // Group rows by service, in the order each service first appears
  const sections = useMemo(() => {
    const order: string[] = [];
    const bySvc = new Map<string, number[]>();
    items.forEach((item, i) => {
      const svc = item.data?.service ?? "other";
      if (!bySvc.has(svc)) {
        bySvc.set(svc, []);
        order.push(svc);
      }
      bySvc.get(svc)!.push(i);
    });
    return order.map((svc) => ({ service: svc, rows: bySvc.get(svc)! }));
  }, [items]);

  const toggleSelected = (i: number) =>
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const toggleExpanded = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const allSelected = approvable.length > 0 && selected.length === approvable.length;
  const toggleAll = () => setDeselected(allSelected ? new Set(approvable) : new Set());

  const handleApprove = async () => {
    if (running || locked || selected.length === 0) return;

    const actions = selected.map((i) => {
      const block = items[i].data as ActionBlock;
      const filled = Object.fromEntries(
        (block.missing ?? []).map((field) => [field, (values[keyOf(block, field)] ?? "").trim()])
      );
      return {
        service: block.service,
        action: block.action,
        title: block.title,
        args: { ...block.args, ...filled },
      };
    });

    for (const f of fields) {
      const value = (values[f.key] ?? "").trim();
      if (value) remember(f.service, { [f.field]: value });
    }

    setRunning(true);
    try {
      const results = await onBatch(actions);
      setSent((prev) => {
        const next = new Set(prev);
        selected.forEach((rowIndex, n) => {
          if (results[n]) next.add(rowIndex);
        });
        return next;
      });
    } finally {
      setRunning(false);
    }
  };

  const total = items.length;
  const showSectionHeaders = sections.length > 1;

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-zinc-200 bg-white first:mt-0 dark:border-white/10 dark:bg-zinc-900/60">
      {/* summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-200 px-3.5 py-2.5 font-mono text-xs dark:border-white/10">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {total} proposed {total === 1 ? "action" : "actions"}
        </span>
        {counts.sent > 0 && <span className={TONES.emerald.text}>{counts.sent} sent</span>}
        {counts.ready > 0 && <span className={TONES.indigo.text}>{counts.ready} ready</span>}
        {counts.needs > 0 && <span className={TONES.amber.text}>{counts.needs} need details</span>}
        {counts.connect > 0 && <span className={TONES.red.text}>{counts.connect} need a connection</span>}
      </div>

      {/* details needed once for the whole set */}
      {fields.length > 0 && (
        <div className="space-y-3 border-b border-zinc-200 bg-amber-50/70 px-3.5 py-3 dark:border-white/10 dark:bg-amber-500/10">
          {fields.map((f) => {
            const meta = getServiceMeta(f.service);
            const label = f.field.replace(/_/g, " ");
            const isNotionDb = f.service === "notion" && f.field.includes("database");
            return (
              <div key={f.key}>
                <label className="block">
                  <span className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs font-medium text-amber-900 dark:text-amber-200">
                    <span className="capitalize">
                      {meta.label} {label}
                    </span>
                    <span className="font-normal text-amber-800/70 dark:text-amber-300/70">
                      applies to {f.count} {f.count === 1 ? "action" : "actions"}
                    </span>
                  </span>
                  <input
                    type="text"
                    value={values[f.key] ?? ""}
                    onChange={(event) => setValues((prev) => ({ ...prev, [f.key]: event.target.value }))}
                    disabled={running}
                    placeholder={`Paste the ${label}`}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-md border border-amber-300/80 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-amber-400/30 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                {isNotionDb && (
                  <p className="mt-1.5 flex gap-1.5 text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-300/70">
                    <FiInfo className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>
                      Open the database in Notion, choose Share, then Copy link. The 32-character code in the link,
                      just before &ldquo;?v=&rdquo;, is the id. It&rsquo;s saved on this device for next time.
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* select-all bar */}
      {approvable.length > 0 && (
        <div className="flex items-center justify-between border-b border-zinc-200 px-3.5 py-2 text-xs dark:border-white/10">
          <label className="flex cursor-pointer items-center gap-2 text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={running || locked}
              className="h-4 w-4 accent-indigo-600"
            />
            Select all ready actions
          </label>
          <span className="font-mono text-zinc-500 dark:text-zinc-400">{selected.length} selected</span>
        </div>
      )}

      {/* rows, grouped by service */}
      {sections.map((section) => {
        const meta = getServiceMeta(section.service);
        return (
          <div key={section.service}>
            {showSectionHeaders && (
              <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300">
                <ServiceChip id={section.service} size="sm" />
                {meta.label}
                <span className="font-mono font-normal text-zinc-400">{section.rows.length}</span>
              </div>
            )}

            <ul>
              {section.rows.map((i) => {
                const block = items[i].data;
                const kind = rowKind(i);
                const isOpen = expanded.has(i);
                const tone =
                  TONES[kind === "sent" ? "emerald" : kind === "connect" ? "red" : kind === "needs" ? "amber" : "indigo"];
                const label =
                  kind === "sent" ? "Sent" : kind === "connect" ? "Connect first" : kind === "needs" ? "Needs details" : "Ready";
                const title = block?.title ?? block?.action ?? "Unreadable action";
                const owner = block ? getOwner(block) : null;
                const args = Object.entries(block?.args ?? {});

                return (
                  <li key={i} className="border-b border-zinc-100 last:border-b-0 dark:border-white/5">
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                      {kind === "sent" ? (
                        <span className="grid h-4 w-4 shrink-0 place-items-center text-emerald-600 dark:text-emerald-400">
                          <FiCheck className="h-4 w-4" aria-label="Sent" />
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={kind === "ready" && !deselected.has(i)}
                          disabled={kind !== "ready" || running || locked}
                          onChange={() => toggleSelected(i)}
                          aria-label={`Select ${title}`}
                          className="h-4 w-4 shrink-0 accent-indigo-600 disabled:opacity-40"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpanded(i)}
                        aria-expanded={isOpen}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {title}
                        </span>
                        {owner && (
                          <span className="hidden shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 sm:inline dark:bg-white/10 dark:text-zinc-300">
                            {owner}
                          </span>
                        )}
                        <span className={`flex shrink-0 items-center gap-1.5 font-mono text-[11px] ${tone.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                          <span className="hidden md:inline">{label}</span>
                        </span>
                        <FiChevronDown
                          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform motion-reduce:transition-none ${
                            isOpen ? "rotate-180" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    {isOpen && block && (
                      <div className="space-y-2 px-3.5 pb-3 pl-10 text-xs">
                        {block.action && (
                          <p className="font-mono text-zinc-400">{block.action}</p>
                        )}
                        {args.length > 0 && (
                          <dl className="space-y-1">
                            {args.map(([key, value]) => (
                              <div key={key} className="flex gap-3">
                                <dt className="w-20 shrink-0 font-mono text-zinc-400">{key.replace(/_/g, " ")}</dt>
                                <dd className="min-w-0 flex-1 break-words text-zinc-700 dark:text-zinc-300">
                                  {formatValue(value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        {block.source && (
                          <p className="border-l-2 border-zinc-200 pl-2.5 italic leading-relaxed text-zinc-500 dark:border-white/15 dark:text-zinc-400">
                            {block.source}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {/* approve */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50 px-3.5 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {running
            ? "Running the approved actions. You can keep this chat open."
            : approvable.length === 0 && counts.needs > 0
              ? "Fill in the details above to enable approval."
              : "Open any row to review it before you approve."}
        </p>
        <button
          type="button"
          onClick={handleApprove}
          disabled={running || locked || selected.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-white/10 dark:disabled:text-zinc-400"
        >
          {running ? (
            "Running…"
          ) : (
            <>
              <FiCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Approve {selected.length} {selected.length === 1 ? "action" : "actions"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}