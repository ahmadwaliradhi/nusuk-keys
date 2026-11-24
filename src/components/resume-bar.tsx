import { History, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { Lang, TFn } from "~/lib/i18n";

export interface Progress {
  lastKey: string;
  lastNo: number;
  at: number;
}

function relativeTime(at: number, lang: Lang) {
  const diff = Math.max(0, Math.round((Date.now() - at) / 1000));
  try {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    if (diff < 45) return rtf.format(0, "second");
    if (diff < 3600) return rtf.format(-Math.max(1, Math.round(diff / 60)), "minute");
    if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
    return rtf.format(-Math.round(diff / 86400), "day");
  } catch {
    return new Date(at).toLocaleString();
  }
}

type Props = { t: TFn; lang: Lang; fmt: (n: number) => string } & (
  | { mode: "resume"; progress: Progress; onResume: () => void; onDismiss: () => void }
  | { mode: "jumped"; no: number; onBack: () => void }
);

/** Slim row above the hero: continue from the last opened code, or return from a jump. */
export function ResumeBar(p: Props) {
  return (
    <div className="mb-4 flex min-h-12 items-center gap-1 rounded-2xl bg-accent/60 ps-3.5 pe-1 text-[13px] text-accent-foreground">
      <History className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate ps-1 font-semibold" role="status">
        {p.mode === "resume"
          ? p.t("resumeShort", {
              no: p.fmt(p.progress.lastNo),
              when: relativeTime(p.progress.at, p.lang),
            })
          : p.t("resumeFrom", { no: p.fmt(p.no) })}
      </p>
      {p.mode === "resume" ? (
        <>
          <Button size="sm" className="h-10 px-3 text-xs" onClick={p.onResume}>
            {p.t("resume")}
          </Button>
          <Button variant="ghost" size="icon" onClick={p.onDismiss} aria-label={p.t("close")}>
            <X />
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" className="px-3 text-xs" onClick={p.onBack}>
          {p.t("backToStart")}
        </Button>
      )}
    </div>
  );
}
