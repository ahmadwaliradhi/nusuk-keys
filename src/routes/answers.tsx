import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Search, X } from "lucide-react";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "~/components/brand";
import { TabBar } from "~/components/tab-bar";
import { Button } from "~/components/ui/button";
import { useLang } from "~/components/use-lang";
import { norm } from "~/lib/answers-shared";
import { ANSWERS_I18N } from "~/lib/i18n";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/answers")({ component: AnswersPage });

const PER = 20;
const SEEN_LS = "nusukkey.soal_seen.v1";

interface Item {
  id: string;
  q: string;
  a: string;
}

function Marked({ text, re: shared }: { text: string; re: RegExp | null }) {
  if (!shared) return <>{text}</>;
  const re = new RegExp(shared.source, shared.flags);
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <mark key={n++} className="rounded bg-accent px-0.5 text-accent-foreground">
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return (
    <>
      {out.map((x, i) => (
        <Fragment key={i}>{x}</Fragment>
      ))}
    </>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;font-size:16px";
    document.body.appendChild(ta);
    ta.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      ta.remove();
    }
  }
}

const AnswerCard = memo(function AnswerCard({
  item,
  re,
  copied,
  copiedLbl,
  hintLbl,
  onCopy,
}: {
  item: Item;
  re: RegExp | null;
  copied: boolean;
  copiedLbl: string;
  hintLbl: string;
  onCopy: (item: Item) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onCopy(item)}
        aria-label={`${hintLbl}: ${item.a}`}
        className="relative block w-full rounded-3xl border bg-card p-5 text-start shadow-sm transition active:scale-[.99] active:bg-accent/50"
      >
        <p className="text-[22px] leading-snug font-extrabold tracking-tight text-primary [overflow-wrap:anywhere]">
          <Marked text={item.a} re={re} />
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          <Marked text={item.q} re={re} />
        </p>
        <span
          className={cn(
            "absolute end-3 top-3 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
            copied ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {copied ? (
            <>
              <Check className="size-3.5" aria-hidden="true" />
              {copiedLbl}
            </>
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
        </span>
      </button>
    </li>
  );
});

function AnswersPage() {
  const { t, fmt } = useLang(ANSWERS_I18N);
  const [items, setItems] = useState<Item[]>([]);
  const [totalAll, setTotalAll] = useState(0);
  const [filtered, setFiltered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const seq = useRef(0);
  const itemsRef = useRef<Item[]>([]);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem(SEEN_LS, "1");
    } catch {}
    return () => clearTimeout(copyTimer.current);
  }, []);

  const load = useCallback(async (q: string, append: boolean) => {
    const mine = ++seq.current;
    setLoading(true);
    setFailed(false);
    const offset = append ? itemsRef.current.length : 0;
    const params = new URLSearchParams({ offset: String(offset), limit: String(PER) });
    if (q) params.set("q", q);
    try {
      const r = await fetch(`/api/answers?${params}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { items: Item[]; total: number; filtered: number };
      if (mine !== seq.current) return;
      const next = append ? itemsRef.current.concat(d.items) : d.items;
      itemsRef.current = next;
      setItems(next);
      setTotalAll(d.total);
      setFiltered(d.filtered);
      setLoading(false);
    } catch {
      if (mine !== seq.current) return;
      setLoading(false);
      setFailed(true);
    }
  }, []);

  const first = useRef(true);
  useEffect(() => {
    const id = setTimeout(
      () => {
        itemsRef.current = [];
        void load(query, false);
      },
      first.current ? 0 : 350,
    );
    first.current = false;
    return () => clearTimeout(id);
  }, [query, load]);

  const onInput = (v: string) => {
    setRaw(v);
    setQuery(v.trim().slice(0, 64));
  };

  const onCopy = useCallback(async (item: Item) => {
    if (!(await copyText(item.a))) return;
    setCopiedId(item.id);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const re = useMemo(() => {
    const tokens = norm(raw).split(" ").filter(Boolean);
    if (!tokens.length) return null;
    const esc = tokens.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    try {
      return new RegExp(`(${esc})`, "ig");
    } catch {
      return null;
    }
  }, [raw]);

  const rest = Math.max(0, filtered - items.length);
  const canMore = !failed && rest > 0;

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !canMore || loading) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && void load(query, true), {
      rootMargin: "400px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [canMore, loading, query, load]);

  const info = failed
    ? t("failMeta")
    : loading && !items.length
      ? t("loading")
      : totalAll === 0
        ? t("noSoal")
        : t("countOf", { a: fmt(filtered), b: fmt(totalAll) });

  return (
    <>
      <header className="mx-auto max-w-[560px] px-4 pt-[calc(0.9rem+env(safe-area-inset-top))] pb-3">
        <Brand />
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      </header>

      <div className="sticky top-0 z-20 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto max-w-[560px] px-4 pb-3">
          <form role="search" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-primary"
                aria-hidden="true"
              />
              <input
                type="search"
                spellCheck={false}
                enterKeyHint="search"
                placeholder={t("ph")}
                aria-label={t("ph")}
                value={raw}
                onChange={(e) => onInput(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && onInput("")}
                className="h-14 w-full rounded-2xl border bg-card ps-12 pe-12 text-base font-semibold shadow-sm outline-none placeholder:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-search-cancel-button]:hidden"
              />
              {raw && (
                <button
                  type="button"
                  aria-label={t("clear")}
                  onClick={() => onInput("")}
                  className="absolute end-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center text-muted-foreground"
                >
                  <X className="size-5" />
                </button>
              )}
            </div>
          </form>
          <p className="mt-2 px-1 text-xs font-semibold text-muted-foreground" role="status">
            {info}
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-[560px] px-4 pt-1 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        <ul className="flex flex-col gap-3">
          {items.map((it) => (
            <AnswerCard
              key={it.id}
              item={it}
              re={re}
              copied={copiedId === it.id}
              copiedLbl={t("copied")}
              hintLbl={t("copyHint")}
              onCopy={onCopy}
            />
          ))}
        </ul>

        {!loading && !failed && items.length === 0 && (
          <p
            className="my-8 text-center text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground"
            dangerouslySetInnerHTML={{ __html: totalAll === 0 ? t("emptyBank") : t("emptySearch") }}
          />
        )}

        {failed && (
          <div className="py-8 text-center">
            <p className="mb-3 text-sm text-muted-foreground">{t("failBody")}</p>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => void load(query, items.length > 0)}
            >
              {t("retry")}
            </Button>
          </div>
        )}

        {canMore && (
          <>
            <div ref={sentinel} aria-hidden="true" />
            <Button
              variant="secondary"
              className="mt-4 min-h-12 w-full rounded-2xl font-bold"
              disabled={loading}
              onClick={() => void load(query, true)}
            >
              {t("more", { n: fmt(Math.min(PER, rest)), a: fmt(items.length), b: fmt(filtered) })}
            </Button>
          </>
        )}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
          {t("note")}
        </p>
      </main>

      <TabBar
        active="answers"
        labels={{ keys: t("tabKeys"), answers: t("tabAnswers"), add: t("tabAdd") }}
      />
    </>
  );
}
