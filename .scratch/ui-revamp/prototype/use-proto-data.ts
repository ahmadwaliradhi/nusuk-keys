// PROTOTYPE — throwaway. Shared read-only data + in-memory stubs for the UI redesign variants.
// Reads real keys from GET /api/keys and the bundled answers.json. No mutation reaches the server.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import answersJson from "~/lib/answers.json";
import { norm } from "~/lib/answers-shared";
import { OPEN_BASE, PINNED_KEY } from "~/lib/keys-shared";

export interface ProtoKey {
  no: number;
  k: string;
  invalid?: boolean;
  pinned?: boolean;
}
export interface ProtoAnswer {
  id: string;
  q: string;
  a: string;
}

const ANSWERS = answersJson as ProtoAnswer[];

function copyText(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).catch(() => {});
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.top = "-1000px";
  document.body.appendChild(el);
  el.select();
  try {
    document.execCommand("copy");
  } catch {}
  document.body.removeChild(el);
  return Promise.resolve();
}

export function useProtoData() {
  const [keys, setKeys] = useState<ProtoKey[]>([]);
  const [validCount, setValidCount] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [keyQuery, setKeyQuery] = useState("");
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [answerQuery, setAnswerQuery] = useState("");
  const seq = useRef(0);
  const keysRef = useRef<ProtoKey[]>([]);

  const load = useCallback(async (q: string, append: boolean) => {
    const mine = ++seq.current;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({ limit: "60", valid: "1" });
    if (q) params.set("q", q);
    const last = append ? [...keysRef.current].reverse().find((i) => !i.pinned) : undefined;
    if (last) params.set("after", String(last.no));
    try {
      const r = await fetch(`/api/keys?${params}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as {
        items: ProtoKey[];
        total: number;
        valid: number;
        hasMore: boolean;
      };
      if (mine !== seq.current) return;
      const items = d.items.map((i) => ({ ...i, pinned: i.pinned || i.k === PINNED_KEY }));
      const next = append
        ? keysRef.current.concat(items.filter((i) => !keysRef.current.some((c) => c.k === i.k)))
        : items;
      keysRef.current = next;
      setKeys(next);
      setTotal(d.total);
      setValidCount(d.valid);
      setHasMore(d.hasMore);
    } catch {
      if (mine === seq.current) setFailed(true);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(keyQuery, false), keyQuery ? 300 : 0);
    return () => clearTimeout(id);
  }, [keyQuery, load]);

  const toggleUsed = useCallback((k: string) => {
    setUsed((cur) => {
      const n = new Set(cur);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }, []);

  /** Stub: flips the flag locally only. */
  const markInvalid = useCallback((k: string, invalid = true) => {
    const next = keysRef.current.map((i) => (i.k === k ? { ...i, invalid } : i));
    keysRef.current = next;
    setKeys(next);
    setValidCount((v) => (v == null ? v : v + (invalid ? -1 : 1)));
  }, []);

  /** Opens the Nusuk link in a new tab and marks the key used. */
  const openKey = useCallback((k: string) => {
    window.open(OPEN_BASE + encodeURIComponent(k), "_blank", "noopener,noreferrer");
    setUsed((cur) => new Set(cur).add(k));
  }, []);

  /** Stub: pretends to save; returns how many looked like keys. */
  const addKeys = useCallback(async (raw: string) => {
    await new Promise((r) => setTimeout(r, 500));
    return raw.split(/\s+/).filter((s) => /^[A-Za-z0-9_-]{5,40}$/.test(s)).length;
  }, []);

  const answers = useMemo(() => {
    const q = norm(answerQuery);
    if (!q) return ANSWERS;
    return ANSWERS.filter((a) => norm(a.q).includes(q) || norm(a.a).includes(q));
  }, [answerQuery]);


  // The pinned code is just the first row: no pinned flag exposed, rows numbered by position.
  // `no` here is display order (1-based), not the DB number; the DB cursor stays in keysRef.
  const shown = useMemo(
    () => keys.map((i, idx) => ({ no: idx + 1, k: i.k, invalid: i.invalid }) as ProtoKey),
    [keys],
  );
  const nextKey = useMemo(
    () => shown.find((i) => !i.invalid && !used.has(i.k)) ?? null,
    [shown, used],
  );

  return {
    // keys
    keys: shown, // loaded page(s), valid-only from server; pinned code silently first, new codes below
    nextKey, // first unused, non-invalid key
    validCount, // server-wide count of usable keys
    total, // server-wide count of all keys
    hasMore,
    loading,
    failed,
    keyQuery,
    setKeyQuery,
    loadMore: () => void load(keyQuery, true),
    retry: () => void load(keyQuery, false),
    used, // Set<string> of keys this device used (in-memory only)
    toggleUsed,
    markInvalid, // (k, invalid=true) local stub
    openKey, // opens Nusuk + marks used
    copy: copyText, // (text) => Promise<void>
    addKeys, // (raw) => Promise<number> stub
    // answers
    answers, // filtered list
    answersTotal: ANSWERS.length,
    answerQuery,
    setAnswerQuery,
  };
}

export type ProtoData = ReturnType<typeof useProtoData>;
