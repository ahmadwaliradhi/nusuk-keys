import { Check, Search, X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { KeyRow, type KeyItem } from "~/components/key-row";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { TFn } from "~/lib/i18n";
import { cn } from "~/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  t: TFn;
  query: string;
  onQuery: (q: string) => void;
  hideUsed: boolean;
  onHideUsed: (v: boolean) => void;
  hideInvalid: boolean;
  onHideInvalid: (v: boolean) => void;
  rows: KeyItem[];
  used: Set<string>;
  loading: boolean;
  failed: boolean;
  empty: string;
  stat: string;
  showMore: boolean;
  moreLabel: string;
  onMore: () => void;
  onRetry: () => void;
  usedCount: number;
  resetLabel: string;
  onReset: () => void;
  onToggle: (item: KeyItem) => void;
  onOpen: (item: KeyItem, e: MouseEvent<HTMLAnchorElement>) => void;
  onInvalid: (item: KeyItem) => void;
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Full-screen searchable list of every code. Plain overlay (not a modal) so toasts stay tappable. */
export function AllKeysSheet(p: Props) {
  const { t } = p;
  const ref = useRef<HTMLDivElement>(null);
  const { open, onClose } = p;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t("allKeys")}
      onKeyDown={onKeyDown}
      className="animate-in fade-in slide-in-from-bottom-6 fixed inset-0 z-40 flex flex-col bg-background outline-none duration-200"
    >
      <div className="mx-auto w-full max-w-[560px] px-4 pt-[calc(0.9rem+env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold">{t("allKeys")}</h2>
            <p
              className="truncate text-xs font-medium text-muted-foreground tabular-nums"
              role="status"
            >
              {p.stat}
            </p>
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full"
            onClick={onClose}
            aria-label={t("close")}
          >
            <X />
          </Button>
        </div>
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            autoComplete="off"
            spellCheck={false}
            dir="ltr"
            className="h-12 rounded-2xl ps-10 font-mono text-base"
            placeholder={t("search")}
            aria-label={t("search")}
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip on={p.hideUsed} onClick={() => p.onHideUsed(true)}>
            {t("filterUnused")}
          </Chip>
          <Chip on={!p.hideUsed} onClick={() => p.onHideUsed(false)}>
            {t("filterAll")}
          </Chip>
          <Chip on={p.hideInvalid} onClick={() => p.onHideInvalid(!p.hideInvalid)}>
            {p.hideInvalid && <Check className="size-4" aria-hidden="true" />}
            {t("hideInvalid")}
          </Chip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[560px] px-4 pb-4">
          {p.rows.length > 0 && (
            <ul className="flex flex-col gap-2">
              {p.rows.map((it) => (
                <KeyRow
                  key={it.k}
                  item={it}
                  used={p.used.has(it.k)}
                  t={t}
                  onToggle={p.onToggle}
                  onOpen={p.onOpen}
                  onInvalid={p.onInvalid}
                />
              ))}
            </ul>
          )}
          {!p.loading && !p.failed && p.rows.length === 0 && (
            <p className="py-14 text-center text-sm text-muted-foreground">{p.empty}</p>
          )}
          {p.failed && (
            <div className="py-8 text-center">
              <p className="mb-3 text-sm text-muted-foreground">{t("loadFailed")}</p>
              <Button variant="outline" onClick={p.onRetry}>
                {t("retry")}
              </Button>
            </div>
          )}
          {p.showMore && (
            <Button
              variant="outline"
              className="mt-3 h-12 w-full rounded-2xl"
              disabled={p.loading}
              onClick={p.onMore}
            >
              {p.moreLabel}
            </Button>
          )}
        </div>
      </div>

      {p.usedCount > 0 && (
        <div className="border-t bg-background pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-[560px] justify-center px-4 py-1">
            <Button variant="link" className="h-11" onClick={p.onReset}>
              {p.resetLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
