import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  KeyRound,
  ListChecks,
  SkipForward,
  X,
} from "lucide-react";
import { useState } from "react";
import type { KeyItem } from "~/components/key-row";
import type { TFn } from "~/lib/i18n";
import { OPEN_BASE } from "~/lib/keys-shared";
import { cn } from "~/lib/utils";

const soft =
  "flex min-h-12 items-center justify-center gap-2 rounded-xl bg-hero-foreground/15 text-sm font-bold outline-none transition active:bg-hero-foreground/25 focus-visible:ring-[3px] focus-visible:ring-hero-foreground/60";

interface HeroProps {
  item: KeyItem;
  /** Ordinal position among the usable codes (never the database number). */
  n: number;
  total: number | null;
  /** The code was just opened: show the inline "did it work?" check-in. */
  awaiting: boolean;
  copied: boolean;
  t: TFn;
  fmt: (n: number) => string;
  onCopyOpen: () => void;
  onReopen: () => void;
  onCopy: () => void;
  onSkip: () => void;
  onWorked: () => void;
  onRejected: () => void;
}

export function KeyHero(p: HeroProps) {
  const { item, t } = p;
  const href = OPEN_BASE + encodeURIComponent(item.k);
  const pct = p.total ? Math.min(100, (p.n / p.total) * 100) : 0;
  return (
    <section
      key={item.k}
      className="animate-in fade-in zoom-in-95 relative overflow-hidden rounded-[28px] bg-hero p-6 text-hero-foreground shadow-[0_18px_40px_-14px] shadow-hero/60 ring-1 ring-hero-foreground/10 duration-300"
    >
      <div className="pointer-events-none absolute -end-12 -top-16 size-48 rounded-full bg-hero-foreground/10" />
      <div className="pointer-events-none absolute -bottom-20 -start-10 size-52 rounded-full bg-black/15" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold opacity-90">
          <span className="tabular-nums">
            {p.total != null ? t("heroCount", { n: p.fmt(p.n), total: p.fmt(p.total) }) : "…"}
          </span>
          <KeyRound className="size-4 shrink-0" aria-hidden="true" />
        </div>
        <div
          className="mt-1.5 h-1 overflow-hidden rounded-full bg-hero-foreground/20"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-hero-foreground transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p
          dir="ltr"
          className="my-9 text-center font-mono text-[30px] leading-tight font-bold tracking-wider break-all [unicode-bidi:isolate] min-[400px]:text-[34px]"
        >
          {item.k}
        </p>

        {p.awaiting ? (
          <div
            className="animate-in fade-in zoom-in-95 duration-200"
            role="group"
            aria-label={t("didItWork")}
          >
            <p className="mb-3 text-center text-base font-extrabold">{t("didItWork")}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={p.onWorked}
                className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-hero-action text-base font-extrabold text-hero-action-foreground outline-none transition active:scale-[.98] focus-visible:ring-[3px] focus-visible:ring-hero-foreground/60"
              >
                <Check className="size-5" aria-hidden="true" />
                {t("worked")}
              </button>
              <button
                type="button"
                onClick={p.onRejected}
                className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-hero-foreground/12 text-base font-extrabold outline-none transition active:scale-[.98] focus-visible:ring-[3px] focus-visible:ring-hero-foreground/60"
              >
                <X className="size-5" aria-hidden="true" />
                {t("rejected")}
              </button>
            </div>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={p.onReopen}
              className="mt-2.5 flex min-h-11 w-full items-center justify-center text-sm font-semibold underline-offset-4 opacity-85 active:underline"
            >
              {t("openAgain")}
            </a>
          </div>
        ) : (
          <>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={p.onCopyOpen}
              className="flex min-h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-hero-action text-lg font-extrabold text-hero-action-foreground shadow-lg outline-none transition active:scale-[.98] focus-visible:ring-[3px] focus-visible:ring-hero-foreground/60"
            >
              <ExternalLink className="size-5" aria-hidden="true" />
              {t("copyOpen")}
            </a>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <button type="button" onClick={p.onCopy} className={soft}>
                {p.copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                {p.copied ? t("copied") : t("copyOnly")}
              </button>
              <button type="button" onClick={p.onSkip} className={soft}>
                <SkipForward className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                {t("skip")}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

interface QueueProps {
  items: KeyItem[];
  copied: string | null;
  t: TFn;
  fmt: (n: number) => string;
  onCopy: (k: string) => void;
}

/** Collapsible peek at the next few codes; tapping one copies it. */
export function KeyQueue({ items, copied, t, fmt, onCopy }: QueueProps) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <section className="mt-5 rounded-3xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-5 text-start outline-none focus-visible:rounded-3xl focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="font-extrabold">
          {t("queue")}{" "}
          <span className="font-semibold text-muted-foreground">
            · {t("queueNext", { n: fmt(items.length) })}
          </span>
        </span>
        <ChevronDown
          className={cn("size-5 text-muted-foreground transition", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul className="animate-in fade-in slide-in-from-top-1 border-t px-2 pb-2 duration-200">
          {items.map((k, i) => (
            <li key={k.k}>
              <button
                type="button"
                onClick={() => onCopy(k.k)}
                aria-label={`${t("copy")}: ${k.k}`}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start outline-none active:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="w-4 text-xs font-bold text-muted-foreground tabular-nums">
                  {fmt(i + 1)}
                </span>
                <span
                  dir="ltr"
                  className="min-w-0 flex-1 truncate font-mono text-sm font-bold [unicode-bidi:isolate]"
                >
                  {k.k}
                </span>
                <span className="text-xs font-semibold text-primary">
                  {copied === k.k ? t("copied") : t("copy")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ViewAllButton({ t, onClick }: { t: TFn; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-primary outline-none active:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ListChecks className="size-4" aria-hidden="true" />
      {t("viewAll")}
    </button>
  );
}
