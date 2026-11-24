import { Check, Copy, ExternalLink, Flag } from "lucide-react";
import { memo, type MouseEvent } from "react";
import { useCopied } from "~/components/clipboard";
import { Button } from "~/components/ui/button";
import type { TFn } from "~/lib/i18n";
import { OPEN_BASE, PINNED_KEY } from "~/lib/keys-shared";
import { cn } from "~/lib/utils";

export interface KeyItem {
  no: number;
  k: string;
  invalid?: boolean;
  pinned?: true;
}

export const isPinnedItem = (i: KeyItem) => !!i.pinned || i.k === PINNED_KEY;

interface RowProps {
  item: KeyItem;
  used: boolean;
  t: TFn;
  onToggle: (item: KeyItem) => void;
  onOpen: (item: KeyItem, e: MouseEvent<HTMLAnchorElement>) => void;
  onInvalid: (item: KeyItem) => void;
}

/** Compact row for the "all codes" sheet. Tapping the code/status toggles the used mark. */
export const KeyRow = memo(function KeyRow({
  item,
  used,
  t,
  onToggle,
  onOpen,
  onInvalid,
}: RowProps) {
  const { copied, copy } = useCopied(1200);
  const pinned = isPinnedItem(item);
  const invalid = !!item.invalid;
  const dim = used || invalid;
  const status = invalid ? t("invalidLabel") : used ? t("usedStatus") : t("filterUnused");
  const copyLabel = `${copied ? t("copied") : t("copy")}: ${item.k}`;

  return (
    <li className="key-row">
      <div className="flex items-center rounded-2xl border bg-card ps-4 pe-1">
        <button
          type="button"
          disabled={invalid}
          onClick={() => onToggle(item)}
          aria-pressed={used}
          aria-label={`${used ? t("unmarkUsed") : t("markUsed")}: ${item.k}`}
          className="min-h-14 min-w-0 flex-1 py-2 text-start outline-none focus-visible:rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            dir="ltr"
            className={cn(
              "block truncate font-mono text-sm font-semibold [unicode-bidi:isolate]",
              dim && "text-muted-foreground line-through",
            )}
          >
            {item.k}
          </span>
          <span
            className={cn(
              "mt-0.5 flex items-center gap-1 text-xs font-medium",
              invalid ? "text-destructive" : used ? "text-primary" : "text-muted-foreground",
            )}
          >
            {used && !invalid && <Check className="size-3" aria-hidden="true" />}
            {status}
            {!pinned && <span className="text-muted-foreground tabular-nums">· #{item.no}</span>}
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => copy(item.k)}
          aria-label={copyLabel}
          title={copied ? t("copied") : t("copy")}
          className="text-muted-foreground"
        >
          {copied ? <Check className="text-primary" /> : <Copy />}
        </Button>
        {invalid ? (
          <Button type="button" variant="ghost" size="icon" disabled aria-label={t("open")}>
            <ExternalLink />
          </Button>
        ) : (
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
            <a
              href={OPEN_BASE + encodeURIComponent(item.k)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t("open")}: ${item.k}`}
              title={t("open")}
              onClick={(e) => onOpen(item, e)}
            >
              <ExternalLink />
            </a>
          </Button>
        )}
        {!pinned && !invalid && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onInvalid(item)}
            aria-label={`${t("markInvalidAria")}: ${item.k}`}
            title={t("invalidLabel")}
            className="text-muted-foreground hover:text-destructive"
          >
            <Flag />
          </Button>
        )}
      </div>
    </li>
  );
});
