import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Globe, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { toast } from "sonner";
import { AddKeysDialog } from "~/components/add-keys-dialog";
import { AllKeysSheet } from "~/components/all-keys-sheet";
import { Brand } from "~/components/brand";
import { useCopied } from "~/components/clipboard";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { KeyHero, KeyQueue, ViewAllButton } from "~/components/key-hero";
import { isPinnedItem, type KeyItem } from "~/components/key-row";
import { ResumeBar, type Progress } from "~/components/resume-bar";
import { TabBar } from "~/components/tab-bar";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "~/components/ui/select";
import { useLang } from "~/components/use-lang";
import { isLang, KEYS_I18N, LANGS } from "~/lib/i18n";
import { OPEN_BASE, PINNED_KEY } from "~/lib/keys-shared";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { add?: 1 } =>
    s.add === 1 || s.add === "1" ? { add: 1 } : {},
  component: KeysPage,
});

const USED_LS = "nusukkey.used.v1";
const HIDE_LS = "nusukkey.hideused.v1";
const HIDE_INVALID_LS = "nusukkey.hideinvalid.v1";
const PROGRESS_LS = "nusukkey.progress.v1";
const PENDING_SS = "nusukkey.pendingopen.v1";
const SEEN_LS = "nusukkey.soal_seen.v1";
const PAGE = 100;
const POLL_MS = 30_000;
const PENDING_WINDOW_MS = 10 * 60_000;
const POOL_MIN = 6;
const QUEUE_SIZE = 4;

interface KeysResponse {
  items: KeyItem[];
  total: number;
  valid: number;
  filtered: number | null;
  hasMore: boolean;
  now: number;
}

interface InvalidSync {
  now: number;
  invalid: string[];
  valid: string[];
}

/** A code that was opened in Nusuk and is waiting for the "did it work?" answer. */
interface Held {
  k: string;
  no: number;
}

const jsonPost = (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

function readProgress(): Progress | null {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_LS) || "null") as Progress | null;
    if (p && typeof p.lastKey === "string" && Number.isFinite(p.lastNo) && Number.isFinite(p.at))
      return p;
  } catch {}
  return null;
}

function readPending(): { k: string; no: number; at: number } | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_SS) || "null") as {
      k?: unknown;
      no?: unknown;
      at?: unknown;
    } | null;
    if (p && typeof p.k === "string" && typeof p.at === "number")
      return { k: p.k, no: typeof p.no === "number" ? p.no : 0, at: p.at };
  } catch {}
  return null;
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_SS);
  } catch {}
}

function KeysPage() {
  const { lang, setLang, t, fmt } = useLang(KEYS_I18N);
  const { add } = Route.useSearch();
  const navigate = useNavigate();
  const [items, setItems] = useState<KeyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [valid, setValid] = useState<number | null>(null);
  const [filtered, setFiltered] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [hideUsed, setHideUsed] = useState(false);
  const [hideInvalid, setHideInvalid] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [invalidTarget, setInvalidTarget] = useState<string | null>(null);
  const [reopenTarget, setReopenTarget] = useState<KeyItem | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resume, setResume] = useState<Progress | null>(null);
  const [startAfter, setStartAfter] = useState(0);
  const [held, setHeld] = useState<Held | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const { copied, copy } = useCopied();

  const itemsRef = useRef<KeyItem[]>([]);
  const seq = useRef(0);
  const loadingRef = useRef(false);
  const autoDepth = useRef(0);
  const usedRef = useRef(used);
  const lastSync = useRef(0);
  const lastPoll = useRef(0);
  const cfg = useRef({ hideInvalid, startAfter });
  useEffect(() => {
    cfg.current = { hideInvalid, startAfter };
  }, [hideInvalid, startAfter]);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // open the add sheet from `/?add=1` (the answers tab links here), then clean the URL
  useEffect(() => {
    if (!add) return;
    setDialog(true);
    void navigate({ to: "/", search: {}, replace: true });
  }, [add, navigate]);

  // hydrate persisted state on the client only
  useEffect(() => {
    let saved = new Set<string>();
    try {
      const raw = JSON.parse(localStorage.getItem(USED_LS) || "[]");
      if (Array.isArray(raw))
        saved = new Set(raw.filter((v): v is string => typeof v === "string"));
    } catch {}
    usedRef.current = saved;
    setUsed(saved);
    try {
      const pref = localStorage.getItem(HIDE_LS);
      setHideUsed(pref == null ? saved.size > 0 : pref === "1");
    } catch {
      setHideUsed(saved.size > 0);
    }
    try {
      setHideInvalid(localStorage.getItem(HIDE_INVALID_LS) !== "0");
    } catch {}
    try {
      setIsNew(localStorage.getItem(SEEN_LS) !== "1");
    } catch {
      setIsNew(true);
    }
    setResume(readProgress());
    const pending = readPending();
    if (pending && Date.now() - pending.at <= PENDING_WINDOW_MS)
      setHeld({ k: pending.k, no: pending.no });
    else if (pending) clearPending();
    setHydrated(true);
  }, []);

  const persistUsed = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(USED_LS, JSON.stringify([...next]));
    } catch {}
  }, []);

  const updateItems = useCallback((fn: (cur: KeyItem[]) => KeyItem[]) => {
    const next = fn(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  }, []);

  const load = useCallback(async (q: string, append: boolean) => {
    if (append && loadingRef.current) return;
    const mine = ++seq.current;
    loadingRef.current = true;
    setLoading(true);
    setFailed(false);
    const cur = itemsRef.current;
    const { hideInvalid: hide, startAfter: start } = cfg.current;
    const params = new URLSearchParams({ limit: String(PAGE) });
    if (q) params.set("q", q);
    if (hide) params.set("valid", "1");
    if (append) {
      const last = [...cur].reverse().find((i) => !isPinnedItem(i));
      if (last) params.set("after", String(last.no));
    } else if (start > 0) params.set("after", String(start));
    try {
      const r = await fetch(`/api/keys?${params}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as KeysResponse;
      if (mine !== seq.current) return;
      let next = cur;
      if (append) {
        const seen = new Set(cur.map((i) => i.k));
        next = cur.concat(d.items.filter((i) => !seen.has(i.k)));
      } else next = d.items;
      if (start === 0) {
        // the pinned code always leads the list from the beginning
        const idx = next.findIndex(isPinnedItem);
        if (idx > 0) next = [next[idx], ...next.slice(0, idx), ...next.slice(idx + 1)];
      }
      itemsRef.current = next;
      setItems(next);
      setTotal(d.total);
      if (typeof d.valid === "number") setValid(d.valid);
      setFiltered(d.filtered);
      setHasMore(d.hasMore);
      if (!append && d.now) lastSync.current = d.now;
      loadingRef.current = false;
      setLoading(false);
    } catch {
      if (mine !== seq.current) return;
      loadingRef.current = false;
      setLoading(false);
      setFailed(true);
    }
  }, []);

  // initial load, debounced search, and reloads when filters or the start cursor change
  const firstRun = useRef(true);
  const prevQuery = useRef(query);
  useEffect(() => {
    if (!hydrated) return;
    autoDepth.current = 0;
    const delay = firstRun.current || prevQuery.current === query ? 0 : 350;
    firstRun.current = false;
    prevQuery.current = query;
    const id = setTimeout(() => {
      loadingRef.current = false;
      itemsRef.current = [];
      void load(query, false);
    }, delay);
    return () => clearTimeout(id);
    // hideInvalid/startAfter are read via cfg inside load; they only trigger the reload.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [hydrated, query, hideInvalid, startAfter, load]);

  // rows of the "all codes" sheet
  const visible = items.filter((i) => !(hideUsed && used.has(i.k)) && !(hideInvalid && i.invalid));

  // hero candidates: usable codes in list order, plus the one awaiting its check-in
  const pool = items.filter((i) => !i.invalid && (!used.has(i.k) || i.k === held?.k));
  const ordered = [
    ...pool.filter((i) => !skipped.includes(i.k)),
    ...pool.filter((i) => skipped.includes(i.k)),
  ];
  const heldItem = held ? (items.find((i) => i.k === held.k) ?? { no: held.no, k: held.k }) : null;
  const hero = (heldItem && !heldItem.invalid ? heldItem : null) ?? ordered[0] ?? null;
  const awaiting = !!hero && hero.k === held?.k;
  const queue = ordered.filter((i) => i.k !== hero?.k).slice(0, QUEUE_SIZE);

  // keep enough rows loaded: for the sheet's filtered list, or for the hero and its queue
  const shortfall = sheet ? visible.length < 20 : pool.length < POOL_MIN;
  useEffect(() => {
    if (!shortfall) {
      autoDepth.current = 0;
      return;
    }
    const cap = !sheet && pool.length === 0 ? 8 : 3;
    if (hasMore && !loading && !failed && autoDepth.current < cap) {
      autoDepth.current += 1;
      void load(query, true);
    }
  }, [shortfall, sheet, pool.length, hasMore, loading, failed, query, load]);

  // ---- cross-user invalid sync ----
  const refreshCounts = useCallback(async () => {
    try {
      const r = await fetch("/api/keys?limit=1&valid=1", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as KeysResponse;
      setTotal(d.total);
      if (typeof d.valid === "number") setValid(d.valid);
    } catch {}
  }, []);

  const pollInvalid = useCallback(async () => {
    const since = lastSync.current;
    if (!since) return;
    lastPoll.current = Date.now();
    try {
      const r = await fetch(`/api/keys/invalid?since=${since}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as InvalidSync;
      if (d.now) lastSync.current = d.now;
      if (!d.invalid?.length && !d.valid?.length) return;
      const bad = new Set(d.invalid);
      const good = new Set(d.valid);
      updateItems((cur) =>
        cur.map((i) => {
          if (isPinnedItem(i)) return i;
          if (bad.has(i.k) && !i.invalid) return { ...i, invalid: true };
          if (good.has(i.k) && i.invalid) return { ...i, invalid: false };
          return i;
        }),
      );
      void refreshCounts();
    } catch {}
  }, [updateItems, refreshCounts]);

  const resolveHeld = useCallback(() => {
    setHeld(null);
    clearPending();
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && Date.now() - lastPoll.current > 3000)
        void pollInvalid();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      tick();
      // an unanswered check-in expires after the pending window
      const pending = readPending();
      if (pending && Date.now() - pending.at > PENDING_WINDOW_MS) resolveHeld();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [pollInvalid, resolveHeld]);

  // ---- progress + used marks ----
  const saveProgress = useCallback((item: KeyItem) => {
    if (isPinnedItem(item)) return;
    const p: Progress = { lastKey: item.k, lastNo: item.no, at: Date.now() };
    try {
      localStorage.setItem(PROGRESS_LS, JSON.stringify(p));
    } catch {}
  }, []);

  const setUsedKeys = useCallback(
    (next: Set<string>) => {
      usedRef.current = next;
      setUsed(next);
      persistUsed(next);
    },
    [persistUsed],
  );

  const onToggle = useCallback(
    (item: KeyItem) => {
      const next = new Set(usedRef.current);
      if (next.has(item.k)) next.delete(item.k);
      else {
        next.add(item.k);
        saveProgress(item);
      }
      setUsedKeys(next);
    },
    [saveProgress, setUsedKeys],
  );

  const recordOpen = useCallback(
    (item: KeyItem, markUsed: boolean) => {
      saveProgress(item);
      try {
        sessionStorage.setItem(
          PENDING_SS,
          JSON.stringify({ k: item.k, no: item.no, at: Date.now() }),
        );
      } catch {}
      setHeld({ k: item.k, no: item.no });
      if (!markUsed || usedRef.current.has(item.k)) return;
      setUsedKeys(new Set(usedRef.current).add(item.k));
      toast(tRef.current("markedUsed"), {
        duration: 5000,
        action: {
          label: tRef.current("undo"),
          onClick: () => {
            const n = new Set(usedRef.current);
            n.delete(item.k);
            setUsedKeys(n);
            // undoing the mark also cancels the pending check-in for that code
            if (readPending()?.k === item.k) clearPending();
            setHeld((h) => (h?.k === item.k ? null : h));
          },
        },
      });
    },
    [saveProgress, setUsedKeys],
  );

  /** Row link in the sheet: a used code asks before opening again. */
  const onOpen = useCallback(
    (item: KeyItem, e: MouseEvent<HTMLAnchorElement>) => {
      if (usedRef.current.has(item.k)) {
        e.preventDefault();
        setReopenTarget(item);
        return;
      }
      recordOpen(item, true);
      setSheet(false);
      setQuery("");
    },
    [recordOpen],
  );

  const onInvalid = useCallback((item: KeyItem) => setInvalidTarget(item.k), []);

  // ---- mark invalid (global) ----
  const flagInvalid = useCallback(
    (k: string, invalid: boolean) => {
      updateItems((cur) => cur.map((i) => (i.k === k ? { ...i, invalid } : i)));
      setValid((v) => (v == null ? v : Math.max(0, v + (invalid ? -1 : 1))));
    },
    [updateItems],
  );

  const undoInvalid = useCallback(
    async (k: string) => {
      flagInvalid(k, false);
      const tt = tRef.current;
      try {
        const r = await jsonPost("/api/keys/invalid", { k, undo: true });
        if (r.ok) return;
        flagInvalid(k, true);
        toast.error(r.status === 409 ? tt("undoExpired") : tt("undoFailed"));
      } catch {
        flagInvalid(k, true);
        toast.error(tt("undoFailed"));
      }
    },
    [flagInvalid],
  );

  const markInvalid = useCallback(
    async (k: string) => {
      const cur = itemsRef.current.find((i) => i.k === k);
      if (cur?.invalid) return;
      const tt = tRef.current;
      if (cur) flagInvalid(k, true);
      const revert = (msg: string) => {
        if (cur) flagInvalid(k, false);
        toast.error(msg);
      };
      try {
        const r = await jsonPost("/api/keys/invalid", { k });
        const d = (await r.json().catch(() => null)) as { status?: string; error?: string } | null;
        if (!r.ok || d?.status !== "success") {
          if (r.status === 403 || d?.error === "pinned") return revert(tt("invalidPinned"));
          if (r.status === 429 || d?.error === "rate") return revert(tt("invalidRate"));
          return revert(tt("invalidFailed"));
        }
      } catch {
        return revert(tt("invalidFailed"));
      }
      toast(tt("markedInvalid"), {
        duration: 10_000,
        action: { label: tt("undo"), onClick: () => void undoInvalid(k) },
      });
    },
    [flagInvalid, undoInvalid],
  );

  // ---- hero actions ----
  const onHeroOpen = (item: KeyItem) => {
    copy(item.k);
    recordOpen(item, true);
  };
  const onHeroReopen = (item: KeyItem) => {
    copy(item.k);
    recordOpen(item, false);
  };
  const onSkip = (k: string) => setSkipped((s) => [...s.filter((x) => x !== k), k]);
  /** The pinned code can't be reported: "rejected" only moves on (it is already marked used). */
  const onRejected = (item: KeyItem) => {
    if (isPinnedItem(item)) resolveHeld();
    else setInvalidTarget(item.k);
  };

  // ---- resume / jump ----
  const jumpTo = (p: Progress) => {
    autoDepth.current = 0;
    setQuery("");
    setStartAfter(Math.max(0, p.lastNo - 1));
    window.scrollTo({ top: 0 });
  };
  const backToStart = () => {
    autoDepth.current = 0;
    setStartAfter(0);
    setResume(null);
    window.scrollTo({ top: 0 });
  };

  const closeSheet = () => {
    setSheet(false);
    if (query) setQuery("");
  };

  const jumped = startAfter > 0;
  const firstRegularNo = ordered.find((i) => !isPinnedItem(i))?.no ?? 0;
  const showResume =
    !jumped &&
    !query &&
    !loading &&
    !!resume &&
    resume.lastKey !== PINNED_KEY &&
    resume.lastNo > firstRegularNo;
  const pinnedLoaded = items.filter(isPinnedItem).length;
  const listTotal = filtered ?? (hideInvalid ? valid : total) ?? 0;
  const rest = Math.max(0, listTotal - (items.length - pinnedLoaded));
  const showMore = hasMore && !failed && (jumped || hideUsed || rest > 0);
  const moreLabel = jumped
    ? t("moreSimple", { n: fmt(PAGE) })
    : t("more", { n: fmt(hideUsed && !rest ? PAGE : Math.min(PAGE, rest)), r: fmt(rest) });

  const heroN = hero
    ? Math.max(1, Math.min(valid ?? Infinity, used.size + (used.has(hero.k) ? 0 : 1)))
    : 0;

  const sheetStat = failed
    ? t("loadFailed")
    : query
      ? t("statFiltered", { a: fmt(filtered ?? 0), b: fmt((hideInvalid ? valid : total) ?? 0) })
      : used.size > 0
        ? t("statUsed", { n: fmt(used.size) })
        : "";

  const loadMore = () => {
    autoDepth.current = 0;
    void load(query, true);
  };

  return (
    <>
      <header className="mx-auto max-w-[560px] px-4 pt-[calc(0.9rem+env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <Select value={lang} onValueChange={(v) => isLang(v) && setLang(v)}>
            <SelectTrigger
              aria-label={t("language")}
              className="h-11 w-auto gap-1.5 rounded-full px-3.5 text-xs font-bold uppercase [&>svg:last-child]:hidden"
            >
              <Globe className="size-4 text-primary" aria-hidden="true" />
              <span>{lang}</span>
            </SelectTrigger>
            <SelectContent align="end">
              {LANGS.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h1 className="text-[26px] leading-tight font-extrabold tracking-tight">
            {t("nextCode")}
          </h1>
          <span
            className="mb-1 shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs font-bold text-primary tabular-nums"
            role="status"
          >
            {valid == null ? "…" : t("availChip", { n: fmt(valid) })}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[560px] px-4 pt-2 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        {jumped ? (
          <ResumeBar
            mode="jumped"
            t={t}
            lang={lang}
            fmt={fmt}
            no={startAfter + 1}
            onBack={backToStart}
          />
        ) : (
          showResume &&
          resume && (
            <ResumeBar
              mode="resume"
              t={t}
              lang={lang}
              fmt={fmt}
              progress={resume}
              onResume={() => jumpTo(resume)}
              onDismiss={() => setResume(null)}
            />
          )
        )}

        {hero ? (
          <KeyHero
            item={hero}
            n={heroN}
            total={valid}
            awaiting={awaiting}
            copied={copied === hero.k}
            t={t}
            fmt={fmt}
            onCopyOpen={() => onHeroOpen(hero)}
            onReopen={() => onHeroReopen(hero)}
            onCopy={() => copy(hero.k)}
            onSkip={() => onSkip(hero.k)}
            onWorked={resolveHeld}
            onRejected={() => onRejected(hero)}
          />
        ) : (
          <div className="rounded-[28px] border bg-card p-8 text-center">
            {loading || !hydrated ? (
              <p className="animate-pulse font-semibold text-muted-foreground">
                {t("loadingKeys")}
              </p>
            ) : failed ? (
              <>
                <p className="font-bold">{t("loadFailed")}</p>
                <Button
                  className="mt-4 h-12 px-6"
                  onClick={() => void load(query, items.length > 0)}
                >
                  {t("retry")}
                </Button>
              </>
            ) : items.length === 0 && total === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">{t("noKeys")}</p>
                <Button className="mt-4 h-12 px-6" onClick={() => setDialog(true)}>
                  <Plus />
                  {t("addKeys")}
                </Button>
              </>
            ) : hasMore ? (
              <>
                <p className="text-lg font-extrabold">{t("allUsed")}</p>
                <Button variant="outline" className="mt-4 h-12 px-6" onClick={loadMore}>
                  {t("moreSimple", { n: fmt(PAGE) })}
                </Button>
              </>
            ) : (
              <>
                <p className="text-lg font-extrabold">{t("allUsed")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("allUsedHint")}</p>
              </>
            )}
          </div>
        )}

        <KeyQueue items={queue} copied={copied} t={t} fmt={fmt} onCopy={copy} />
        <ViewAllButton t={t} onClick={() => setSheet(true)} />
      </main>

      <AllKeysSheet
        open={sheet}
        onClose={closeSheet}
        t={t}
        query={query}
        onQuery={(v) => {
          setStartAfter(0);
          setQuery(v.trim().toLowerCase().slice(0, 64));
        }}
        hideUsed={hideUsed}
        onHideUsed={(v) => {
          autoDepth.current = 0;
          setHideUsed(v);
          try {
            localStorage.setItem(HIDE_LS, v ? "1" : "0");
          } catch {}
        }}
        hideInvalid={hideInvalid}
        onHideInvalid={(v) => {
          autoDepth.current = 0;
          setHideInvalid(v);
          try {
            localStorage.setItem(HIDE_INVALID_LS, v ? "1" : "0");
          } catch {}
        }}
        rows={visible}
        used={used}
        loading={loading}
        failed={failed}
        empty={total === 0 ? t("noKeys") : t("noMatch")}
        stat={sheetStat}
        showMore={showMore}
        moreLabel={moreLabel}
        onMore={loadMore}
        onRetry={() => void load(query, items.length > 0)}
        usedCount={used.size}
        resetLabel={t("resetUsed", { n: fmt(used.size) })}
        onReset={() => setResetOpen(true)}
        onToggle={onToggle}
        onOpen={onOpen}
        onInvalid={onInvalid}
      />

      <TabBar
        active="keys"
        labels={{ keys: t("tabKeys"), answers: t("tabAnswers"), add: t("tabAdd") }}
        onAdd={() => setDialog(true)}
        answersNew={isNew}
        onAnswersClick={() => {
          setIsNew(false);
          try {
            localStorage.setItem(SEEN_LS, "1");
          } catch {}
        }}
      />

      <AddKeysDialog
        open={dialog}
        onOpenChange={setDialog}
        t={t}
        fmt={fmt}
        onSaved={(summary) => {
          toast(summary);
          void load(query, false);
        }}
      />

      <ConfirmDialog
        open={invalidTarget != null}
        onOpenChange={(o) => !o && setInvalidTarget(null)}
        title={t("invalidTitle")}
        description={t("invalidBodyShort")}
        code={invalidTarget ?? undefined}
        cancelLabel={t("cancel")}
        confirmLabel={t("invalidConfirm")}
        closeLabel={t("close")}
        destructive
        onConfirm={() => {
          if (!invalidTarget) return;
          void markInvalid(invalidTarget);
          if (held?.k === invalidTarget) resolveHeld();
        }}
      />

      <ConfirmDialog
        open={reopenTarget != null}
        onOpenChange={(o) => !o && setReopenTarget(null)}
        title={t("usedTitle")}
        description={t("usedBody")}
        code={reopenTarget?.k}
        cancelLabel={t("cancel")}
        confirmLabel={t("openAnyway")}
        closeLabel={t("close")}
        onConfirm={() => {
          if (!reopenTarget) return;
          recordOpen(reopenTarget, false);
          setSheet(false);
          setQuery("");
          window.open(
            OPEN_BASE + encodeURIComponent(reopenTarget.k),
            "_blank",
            "noopener,noreferrer",
          );
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t("resetUsed", { n: fmt(used.size) })}
        description={t("resetConfirm")}
        cancelLabel={t("cancel")}
        confirmLabel={t("reset")}
        closeLabel={t("close")}
        onConfirm={() => {
          setUsedKeys(new Set());
          toast(t("resetDone"));
        }}
      />
    </>
  );
}
