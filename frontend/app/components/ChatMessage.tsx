"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { FiAlertTriangle, FiCheck, FiCopy, FiLink2, FiPaperclip, FiX } from "react-icons/fi";
import type { ChatMessage as ChatMessageType } from "../types/chat";
// If your file is named ServiceIcon.tsx, change this path to "../lib/ServiceIcon"
import { ServiceChip, getServiceMeta } from "../lib/ServiceIcon";
import {
  TONES,
  readRemembered,
  remember,
  type ActionBlock,
  type ActionItem,
  type BatchHandler,
} from "../lib/Action";
import ActionList from "../lib/ActionList";
import BrandMark from "./BrandMark";

interface ChatMessageProps {
  message: ChatMessageType;
  onReply?: (text: string) => void;
  onBatch?: BatchHandler;
  busy?: boolean;
  awaitingConfirmation?: boolean;
  isLatest?: boolean;
}

type Segment =
  | { type: "text"; content: string }
  | { type: "actions"; items: ActionItem[] };

const ACTION_REGEX = /```meetpilot-action\s*([\s\S]*?)```/g;

/** Splits a reply into prose and action blocks. Back-to-back action blocks are grouped into one set. */
function splitSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const pushText = (content: string) => {
    if (content.trim()) segments.push({ type: "text", content });
  };

  let lastIndex = 0;
  for (const match of text.matchAll(ACTION_REGEX)) {
    const index = match.index ?? 0;
    pushText(text.slice(lastIndex, index));

    const raw = match[1].trim();
    let data: ActionBlock | null = null;
    try {
      data = JSON.parse(raw) as ActionBlock;
    } catch {
      data = null;
    }

    const last = segments[segments.length - 1];
    if (last && last.type === "actions") last.items.push({ raw, data });
    else segments.push({ type: "actions", items: [{ raw, data }] });

    lastIndex = index + match[0].length;
  }
  pushText(text.slice(lastIndex));
  return segments;
}

/* ---------- prose rendering ---------- */

function renderInline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return (
          <strong key={i} className="font-semibold text-zinc-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code
            key={i}
            className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[0.85em] text-indigo-700 dark:text-indigo-300"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={i}>{part}</span>;
    });
}

function RichText({ content }: { content: string }) {
  const nodes: ReactNode[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flushList = (key: string) => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{renderInline(item)}</li>);
    nodes.push(
      list.kind === "ul" ? (
        <ul key={key} className="my-2 list-disc space-y-1.5 pl-5 marker:text-indigo-400">
          {items}
        </ul>
      ) : (
        <ol key={key} className="my-2 list-decimal space-y-1.5 pl-5 marker:text-indigo-400">
          {items}
        </ol>
      )
    );
    list = null;
  };

  content.split("\n").forEach((line, i) => {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const listItem = bullet?.[1] ?? numbered?.[1];

    if (listItem !== undefined) {
      const kind = bullet ? "ul" : "ol";
      if (list && list.kind !== kind) flushList(`list-${i}`);
      if (!list) list = { kind, items: [] };
      list.items.push(listItem);
      return;
    }
    flushList(`list-${i}`);

    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) {
      nodes.push(
        <h4
          key={i}
          className="mb-1 mt-5 text-base font-semibold tracking-tight text-zinc-900 first:mt-0 dark:text-white"
        >
          {renderInline(heading[1])}
        </h4>
      );
      return;
    }

    if (!line.trim()) return;
    nodes.push(
      <p key={i} className="my-2 first:mt-0">
        {renderInline(line)}
      </p>
    );
  });

  flushList("list-end");
  return <>{nodes}</>;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  return JSON.stringify(value);
}

/* ---------- action cards ---------- */

function ActionCard({
  block,
  raw,
  onReply,
  locked,
}: {
  block: ActionBlock | null;
  raw: string;
  onReply?: (text: string) => void;
  locked: boolean;
}) {
  const [sent, setSent] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    readRemembered(block?.service, block?.missing ?? [])
  );

  if (!block) {
    return (
      <pre className="my-2 overflow-x-auto rounded-xl bg-zinc-900/[0.06] p-3 font-mono text-xs dark:bg-white/10">
        {raw}
      </pre>
    );
  }

  const meta = getServiceMeta(block.service);
  const missing = block.missing ?? [];
  const unresolved = missing.filter((field) => !(values[field] ?? "").trim());
  const needsConnection = block.status === "needs_connection";
  const args = Object.entries(block.args ?? {});
  const canApprove = !!onReply && !locked && !sent && unresolved.length === 0 && !needsConnection;

  const tone = TONES[sent ? "emerald" : needsConnection ? "red" : unresolved.length > 0 ? "amber" : "indigo"];
  const statusLabel = sent
    ? "Sent"
    : needsConnection
      ? "Connect first"
      : unresolved.length > 0
        ? "Needs details"
        : "Ready";

  const handleApprove = () => {
    if (!onReply || !canApprove) return;
    const filled = Object.fromEntries(missing.map((field) => [field, (values[field] ?? "").trim()]));
    remember(block.service, filled);
    setSent(true);
    onReply(
      `Approve and execute: ${JSON.stringify({
        service: block.service,
        action: block.action,
        args: { ...block.args, ...filled },
      })}`
    );
  };

  const buttonLabel = sent
    ? "Sent for approval"
    : unresolved.length > 0
      ? `Fill in ${unresolved.length} ${unresolved.length === 1 ? "field" : "fields"} to continue`
      : "Approve and run";

  return (
    <div className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white pl-0.5 text-zinc-900 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-100">
      <span className={`absolute inset-y-0 left-0 w-0.5 ${tone.rail}`} aria-hidden="true" />

      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <ServiceChip id={block.service} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight">{meta.label}</p>
            {block.action && (
              <p className="truncate font-mono text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                {block.action}
              </p>
            )}
          </div>
        </div>
        <span className={`flex shrink-0 items-center gap-1.5 font-mono text-[11px] ${tone.text}`}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${tone.dot} ${
              !sent && !needsConnection && unresolved.length === 0 ? "animate-pulse motion-reduce:animate-none" : ""
            }`}
            aria-hidden="true"
          />
          {statusLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-3.5 pb-3.5 pt-2.5">
        {block.title && <p className="text-sm font-medium leading-snug">{block.title}</p>}

        {args.length > 0 && (
          <dl className="space-y-1 text-xs">
            {args.map(([key, value]) => (
              <div key={key} className="flex gap-3">
                <dt className="w-24 shrink-0 font-mono text-zinc-400">{key.replace(/_/g, " ")}</dt>
                <dd className="min-w-0 flex-1 break-words text-zinc-700 line-clamp-3 dark:text-zinc-300">
                  {formatValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {block.source && (
          <p className="border-l-2 border-zinc-200 pl-2.5 text-xs italic leading-relaxed text-zinc-500 line-clamp-2 dark:border-white/15 dark:text-zinc-400">
            {block.source}
          </p>
        )}

        {missing.length > 0 && !sent && (
          <div className="space-y-2 rounded-lg bg-amber-50 p-2.5 ring-1 ring-amber-200/80 dark:bg-amber-500/10 dark:ring-amber-400/20">
            {missing.map((field) => (
              <label key={field} className="block">
                <span className="mb-1 block text-xs font-medium capitalize text-amber-800 dark:text-amber-300">
                  {field.replace(/_/g, " ")}
                </span>
                <input
                  type="text"
                  value={values[field] ?? ""}
                  onChange={(event) => setValues((prev) => ({ ...prev, [field]: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleApprove();
                  }}
                  placeholder={`Enter ${field.replace(/_/g, " ")}`}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-md border border-amber-300/80 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-amber-400/30 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
            ))}
            <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70">
              Saved on this device and reused for the same field.
            </p>
          </div>
        )}

        {needsConnection && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
            <FiLink2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Turn on {meta.label} under Connectors in the sidebar, then ask again.
          </p>
        )}

        {onReply && !needsConnection && (
          <button
            type="button"
            onClick={handleApprove}
            disabled={!canApprove}
            className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-white/10 dark:disabled:text-zinc-400"
          >
            {sent && <FiCheck className="h-3.5 w-3.5" aria-hidden="true" />}
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function ActionGroup({
  items,
  onReply,
  onBatch,
  locked,
}: {
  items: ActionItem[];
  onReply?: (text: string) => void;
  onBatch?: BatchHandler;
  locked: boolean;
}) {
  if (items.length > 2 && onBatch) {
    return <ActionList items={items} onBatch={onBatch} locked={locked} />;
  }

  const parsed = items.filter((item) => item.data).map((item) => item.data as ActionBlock);
  const needConnect = parsed.filter((b) => b.status === "needs_connection").length;
  const needDetails = parsed.filter(
    (b) => b.status !== "needs_connection" && (b.missing?.length ?? 0) > 0
  ).length;
  const ready = parsed.length - needConnect - needDetails;
  const total = items.length;

  return (
    <div className="my-4 first:mt-0">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {total} proposed {total === 1 ? "action" : "actions"}
        </span>
        {ready > 0 && <span className="text-emerald-600 dark:text-emerald-400">{ready} ready</span>}
        {needDetails > 0 && (
          <span className="text-amber-600 dark:text-amber-400">{needDetails} need details</span>
        )}
        {needConnect > 0 && (
          <span className="text-red-600 dark:text-red-400">{needConnect} need a connection</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, i) => (
          <ActionCard key={i} block={item.data} raw={item.raw} onReply={onReply} locked={locked} />
        ))}
      </div>
    </div>
  );
}

/* ---------- message ---------- */

export default function ChatMessage({
  message,
  onReply,
  onBatch,
  busy = false,
  awaitingConfirmation = false,
  isLatest = false,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isConfirmation = Boolean(message.isConfirmationPrompt);
  const showConfirmButtons = isConfirmation && isLatest && awaitingConfirmation && !busy && !!onReply;
  const cardsLocked = busy || awaitingConfirmation;

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="flex min-w-0 max-w-[85%] flex-col items-end">
          <div className="break-words rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white">
            {message.attachment && (
              <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-white/15 px-2 py-1 text-xs text-indigo-50">
                <FiPaperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{message.attachment.name}</span>
              </div>
            )}
            <span className="whitespace-pre-wrap">{message.text}</span>
          </div>
          <span className="mt-1 px-1 text-[11px] text-zinc-400">{time}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex w-full gap-3">
      {/* rail: avatar plus a line that runs down the length of the reply */}
      <div className="flex shrink-0 flex-col items-center">
        <BrandMark className="h-7 w-7 rounded-lg" iconClassName="h-3.5 w-3.5" />
        <span
          className="mt-2 w-px flex-1 bg-gradient-to-b from-indigo-500/50 via-zinc-200 to-transparent dark:via-white/10"
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0 flex-1 pb-2">
        <div className="mb-1.5 flex items-center gap-2 text-xs">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">MeetPilot</span>
          <span className="text-zinc-400">{time}</span>
        </div>

        {isConfirmation ? (
          <div className="rounded-xl border border-amber-300/80 bg-amber-50 p-3.5 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
              <FiAlertTriangle className="h-4 w-4" aria-hidden="true" />
              <span>Confirmation needed</span>
            </div>
            <p className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{message.text}</p>
            {showConfirmButtons && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onReply?.("Yes, approve")}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
                  >
                    <FiCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onReply?.("No, cancel this")}
                    className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    <FiX className="h-3.5 w-3.5" aria-hidden="true" />
                    Reject
                  </button>
                </div>
                <p className="text-xs opacity-70">
                  Or type a change below, e.g. &ldquo;make it 9pm&rdquo;.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="break-words text-[15px] leading-7 text-zinc-700 dark:text-zinc-300">
            {splitSegments(message.text).map((segment, i) =>
              segment.type === "text" ? (
                <RichText key={i} content={segment.content} />
              ) : (
                <ActionGroup key={i} items={segment.items} onReply={onReply} onBatch={onBatch} locked={cardsLocked} />
              )
            )}
          </div>
        )}

        {!isConfirmation && (
          <div className="mt-1 flex items-center">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-zinc-400 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            >
              {copied ? (
                <FiCheck className="h-3 w-3" aria-hidden="true" />
              ) : (
                <FiCopy className="h-3 w-3" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}