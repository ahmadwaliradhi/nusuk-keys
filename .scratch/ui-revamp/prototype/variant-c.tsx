// PROTOTYPE — throwaway. Variant C: "Guided home" — dashboard + ticket carousel + quiz companion.
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  KeyRound,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import type { ProtoAnswer, ProtoData, ProtoKey } from "./use-proto-data";

export const VARIANT_C_NAME = "Guided home";

const SAGE = "#3f6b4f";
const TERRA = "#c2603f";
const INK = "#1f2a24";
const BG = "#f3f6f1";
const GOAL = 10;
const CUT = 150; // px from ticket top where the perforation sits
const SAFE_B = "calc(env(safe-area-inset-bottom) + 1rem)";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap";

type SheetName = null | "search" | "quiz" | "add" | "report";

function Mark({ size = 36, color = SAGE }: { size?: number; color?: string }) {
  // 8-point star (two rotated squares) with a centre dot — rub el hizb inspired
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round">
      <rect x="9" y="9" width="22" height="22" rx="2" />
      <rect x="9" y="9" width="22" height="22" rx="2" transform="rotate(45 20 20)" />
      <circle cx="20" cy="20" r="3.5" fill={color} stroke="none" />
    </svg>
  );
}

function Ring({ value, size = 112 }: { value: number; size?: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0 -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="9" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="#f1d9c8"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, value))}
        style={{ transition: "stroke-dashoffset .6s ease" }}
      />
    </svg>
  );
}

function Sheet({
  onClose,
  full,
  children,
  label,
}: {
  onClose: () => void;
  full?: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-label={label}>
      <button
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-[#1f2a24]/45 animate-in fade-in duration-200"
      />
      <div
        className={cn(
          "relative flex flex-col overflow-hidden bg-white animate-in slide-in-from-bottom duration-300",
          full ? "h-full" : "max-h-[90%] rounded-t-[28px]",
        )}
        style={{ background: full ? BG : "#fff" }}
      >
        {children}
      </div>
    </div>
  );
}

function Stamp({ status }: { status: "BARU" | "DIPAKAI" | "DITOLAK" | "DISEMATKAN" }) {
  const tone: Record<string, CSSProperties> = {
    BARU: { borderColor: SAGE, color: SAGE },
    DIPAKAI: { borderColor: "#a3a3a3", color: "#737373" },
    DITOLAK: { borderColor: TERRA, color: TERRA },
    DISEMATKAN: { borderColor: TERRA, color: "#fff", background: TERRA },
  };
  return (
    <span
      className="inline-block -rotate-6 rounded-md border-2 px-2 py-0.5 text-[11px] font-bold tracking-[.14em]"
      style={tone[status]}
    >
      {status}
    </span>
  );
}

function statusOf(k: ProtoKey, used: Set<string>) {
  if (k.invalid) return "DITOLAK" as const;
  if (k.pinned) return "DISEMATKAN" as const;
  if (used.has(k.k)) return "DIPAKAI" as const;
  return "BARU" as const;
}

function Ticket({ item, used, active }: { item: ProtoKey; used: Set<string>; active: boolean }) {
  const st = statusOf(item, used);
  const mask: CSSProperties = {
    WebkitMaskImage: `radial-gradient(circle 14px at 0 ${CUT}px, #0000 97%, #000), radial-gradient(circle 14px at 100% ${CUT}px, #0000 97%, #000)`,
    maskImage: `radial-gradient(circle 14px at 0 ${CUT}px, #0000 97%, #000), radial-gradient(circle 14px at 100% ${CUT}px, #0000 97%, #000)`,
    WebkitMaskComposite: "source-in",
    maskComposite: "intersect",
  };
  return (
    <div
      className="w-[80%] shrink-0 snap-center transition-transform duration-300"
      style={{
        filter: "drop-shadow(0 14px 18px rgba(31,42,36,.14))",
        transform: active ? "scale(1)" : "scale(.94)",
        opacity: active ? 1 : 0.7,
      }}
    >
      <div className="relative h-[232px] rounded-[28px] bg-white" style={mask}>
        <div className="absolute inset-x-0 top-0 rounded-t-[28px] px-6 pt-5" style={{ height: CUT }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium tracking-wide text-neutral-400">KODE NO. {item.no}</span>
            <Stamp status={st} />
          </div>
          <div
            className="mt-5 break-all text-[28px] font-semibold leading-tight"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: INK }}
          >
            {item.k}
          </div>
        </div>
        <div
          className="absolute inset-x-6 border-t-2 border-dashed"
          style={{ top: CUT, borderColor: "#d5ddd2" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col justify-center gap-1 px-6"
          style={{ top: CUT }}
        >
          <p className="text-sm font-medium" style={{ color: INK }}>
            {st === "DIPAKAI"
              ? "Sudah kamu pakai di perangkat ini"
              : st === "DITOLAK"
                ? "Ditandai tidak valid untuk semua"
                : st === "DISEMATKAN"
                  ? "Kode utama, selalu di depan"
                  : "Belum dipakai, siap dibuka"}
          </p>
          <p className="text-xs text-neutral-400">Geser untuk kode berikutnya →</p>
        </div>
      </div>
    </div>
  );
}

export function VariantC({ data }: { data: ProtoData }) {
  const [sheet, setSheet] = useState<SheetName>(null);
  const [guide, setGuide] = useState(true);
  const [idx, setIdx] = useState(0);
  const [toast, setToast] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  // quiz
  const [deck, setDeck] = useState<ProtoAnswer[] | null>(null);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rand, setRand] = useState(false);

  // add
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  const keys = data.keys;
  const cur = keys[Math.min(idx, Math.max(0, keys.length - 1))];
  const shown = (data.validCount ?? 0) as number;
  const usedCount = data.used.size;

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 1600);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (keys.length && idx >= keys.length - 3 && data.hasMore && !data.loading && !data.keyQuery) data.loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, keys.length, data.hasMore, data.loading]);

  const onScroll = () => {
    const el = scroller.current;
    const first = el?.children[0] as HTMLElement | undefined;
    if (!el || !first) return;
    const step = first.offsetWidth + 12;
    setIdx(Math.max(0, Math.min(keys.length - 1, Math.round(el.scrollLeft / step))));
  };

  const copy = async (k: string) => {
    await data.copy(k);
    setGuide(false);
    setToast("Kode disalin");
  };
  const open = (k: string) => {
    data.openKey(k);
    setGuide(false);
  };
  const close = () => {
    if (sheet === "search") data.setKeyQuery("");
    if (sheet === "quiz") {
      data.setAnswerQuery("");
      setDeck(null);
      setFlipped(false);
    }
    if (sheet === "add") {
      setAdded(null);
      setRaw("");
    }
    setSheet(null);
  };

  const list = data.answers.slice(0, 60);
  const pick = () => data.answers[Math.floor(Math.random() * data.answers.length)];
  const startRandom = () => {
    setRand(true);
    setDeck([pick()]);
    setPos(0);
    setFlipped(false);
  };
  const go = (d: number) => {
    if (!deck) return;
    setFlipped(false);
    if (rand && pos + d >= deck.length) {
      setDeck([...deck, pick()]);
      setPos(pos + 1);
    } else setPos(Math.max(0, Math.min(deck.length - 1, pos + d)));
  };

  const submitAdd = async () => {
    setBusy(true);
    setAdded(await data.addKeys(raw));
    setBusy(false);
  };

  const steps = [
    ["1", "Salin kode"],
    ["2", "Buka Nusuk"],
    ["3", "Laporkan jika ditolak"],
  ];

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden sm:min-h-[860px]"
      style={{ background: BG, color: INK, fontFamily: "'Outfit', system-ui, sans-serif" }}
    >
      <link rel="stylesheet" href={FONT_URL} precedence="default" />

      <div style={{ paddingBottom: SAFE_B }}>
        {/* Header */}
        <header className="px-5 pt-[3.25rem]">
          <div className="flex items-center gap-3">
            <Mark />
            <div className="min-w-0 flex-1">
              <p className="text-[22px] font-semibold leading-tight">Assalamu'alaikum 👋</p>
              <p className="text-sm text-neutral-500">Yuk siapkan kode Nusuk kamu</p>
            </div>
            <button
              onClick={() => setSheet("search")}
              aria-label="Cari kode"
              className="grid size-12 place-items-center rounded-full bg-white shadow-[0_4px_14px_rgba(31,42,36,.08)] active:scale-95"
            >
              <Search className="size-5" />
            </button>
          </div>

          <div
            className="mt-5 flex items-center gap-5 rounded-[28px] p-5 text-white shadow-[0_16px_28px_-12px_rgba(63,107,79,.6)]"
            style={{ background: `linear-gradient(145deg, ${SAGE}, #2f5440)` }}
          >
            <div className="relative grid place-items-center">
              <Ring value={usedCount / GOAL} />
              <div className="absolute text-center">
                <div className="text-3xl font-semibold leading-none">{usedCount}</div>
                <div className="mt-0.5 text-[11px] text-white/70">dari {GOAL}</div>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white/75">Kode terpakai di perangkat ini</p>
              <p className="mt-2 text-2xl font-semibold leading-tight">
                {data.validCount == null ? "…" : shown.toLocaleString("id-ID")} <span className="text-base font-medium">kode tersedia</span>
              </p>
              <p className="mt-1 text-xs text-white/60">
                {usedCount >= GOAL ? "Target tercapai, mantap!" : `${GOAL - usedCount} lagi untuk capai target`}
              </p>
            </div>
          </div>
        </header>

        {/* Guide */}
        <section className="px-5 pt-4">
          {guide ? (
            <div className="rounded-[28px] bg-white p-4 shadow-[0_6px_18px_rgba(31,42,36,.06)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Cara pakai</h2>
                <button onClick={() => setGuide(false)} className="-my-2 -mr-2 px-3 py-3 text-xs font-medium" style={{ color: SAGE }}>
                  Mengerti
                </button>
              </div>
              <ol className="grid grid-cols-3 gap-2">
                {steps.map(([n, t]) => (
                  <li key={n} className="rounded-2xl p-3 text-center" style={{ background: "#eef3ec" }}>
                    <span
                      className="mx-auto grid size-7 place-items-center rounded-full text-sm font-semibold text-white"
                      style={{ background: n === "3" ? TERRA : SAGE }}
                    >
                      {n}
                    </span>
                    <p className="mt-2 text-[13px] font-medium leading-snug">{t}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <button
              onClick={() => setGuide(true)}
              className="flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium shadow-[0_4px_12px_rgba(31,42,36,.06)]"
            >
              <span className="grid size-5 place-items-center rounded-full text-[11px] text-white" style={{ background: SAGE }}>
                ?
              </span>
              Lihat cara pakai
            </button>
          )}
        </section>

        {/* Ticket carousel */}
        <section className="pt-6">
          <div className="flex items-end justify-between px-5 pb-3">
            <h2 className="text-lg font-semibold">Kode untukmu</h2>
            {keys.length > 0 && (
              <span className="text-sm tabular-nums text-neutral-500">
                {Math.min(idx + 1, keys.length)} / {keys.length}
                {data.hasMore ? "+" : ""}
              </span>
            )}
          </div>

          {keys.length === 0 ? (
            <div className="mx-5 grid h-[232px] place-items-center rounded-[28px] bg-white text-center text-sm text-neutral-500">
              {data.failed ? (
                <div>
                  <p>Gagal memuat kode.</p>
                  <button onClick={data.retry} className="mt-3 h-11 rounded-full px-5 font-medium text-white" style={{ background: SAGE }}>
                    Coba lagi
                  </button>
                </div>
              ) : data.loading ? (
                "Memuat kode…"
              ) : (
                "Belum ada kode."
              )}
            </div>
          ) : (
            <>
              <div
                ref={scroller}
                onScroll={onScroll}
                className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-[10%] pb-6 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {keys.map((k, i) => (
                  <Ticket key={k.k} item={k} used={data.used} active={i === idx} />
                ))}
                {data.hasMore && (
                  <div className="grid w-[30%] shrink-0 place-items-center text-xs text-neutral-400">Memuat…</div>
                )}
              </div>

              <div className="-mt-2 flex justify-center gap-1.5 pb-4">
                {keys.slice(Math.max(0, Math.min(idx - 3, keys.length - 7)), Math.max(0, Math.min(idx - 3, keys.length - 7)) + 7).map((k, i) => {
                  const real = Math.max(0, Math.min(idx - 3, keys.length - 7)) + i;
                  return (
                    <span
                      key={k.k}
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: real === idx ? 20 : 6, background: real === idx ? SAGE : "#cfd8cb" }}
                    />
                  );
                })}
              </div>

              {cur && (
                <div className="px-5">
                  <button
                    onClick={() => open(cur.k)}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-white shadow-[0_12px_22px_-10px_rgba(63,107,79,.8)] active:scale-[.98]"
                    style={{ background: SAGE }}
                  >
                    <ExternalLink className="size-5" /> Buka di Nusuk
                  </button>
                  <button
                    onClick={() => copy(cur.k)}
                    className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold shadow-[0_4px_12px_rgba(31,42,36,.06)] active:scale-[.98]"
                    style={{ color: SAGE }}
                  >
                    <Copy className="size-4" /> Salin kode
                  </button>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <button onClick={() => data.toggleUsed(cur.k)} className="h-11 pr-3 text-neutral-500 underline-offset-4 hover:underline">
                      {data.used.has(cur.k) ? "Tandai belum dipakai" : "Tandai sudah dipakai"}
                    </button>
                    {!cur.pinned && (
                      <button
                        onClick={() => setSheet("report")}
                        className="h-11 pl-3 underline underline-offset-4"
                        style={{ color: TERRA }}
                      >
                        Kode ditolak?
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Tiles */}
        <section className="grid grid-cols-2 gap-3 px-5 pt-5">
          <button
            onClick={() => setSheet("quiz")}
            className="flex min-h-[148px] flex-col justify-between rounded-[28px] p-5 text-left text-white shadow-[0_14px_24px_-12px_rgba(194,96,63,.7)] active:scale-[.98]"
            style={{ background: `linear-gradient(150deg, ${TERRA}, #a84d30)` }}
          >
            <BookOpen className="size-7" />
            <div>
              <p className="text-lg font-semibold leading-tight">Kunci Jawaban</p>
              <p className="mt-1 text-xs text-white/80">{data.answersTotal} soal siap dicari</p>
            </div>
          </button>
          <button
            onClick={() => setSheet("add")}
            className="flex min-h-[148px] flex-col justify-between rounded-[28px] bg-white p-5 text-left shadow-[0_6px_18px_rgba(31,42,36,.07)] active:scale-[.98]"
          >
            <span className="grid size-10 place-items-center rounded-2xl" style={{ background: "#e4ede3", color: SAGE }}>
              <Plus className="size-6" />
            </span>
            <div>
              <p className="text-lg font-semibold leading-tight">Tambah kode</p>
              <p className="mt-1 text-xs text-neutral-500">Bagikan ke jamaah lain</p>
            </div>
          </button>
        </section>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="pointer-events-none fixed inset-x-0 z-50 flex justify-center animate-in fade-in slide-in-from-bottom-2"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
        >
          <span className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg" style={{ background: INK }}>
            <Check className="size-4" /> {toast}
          </span>
        </div>
      )}

      {/* Search sheet */}
      {sheet === "search" && (
        <Sheet full onClose={close} label="Cari kode">
          <div className="flex items-center gap-2 px-4 pb-3 pt-[3.25rem]">
            <div className="flex h-12 flex-1 items-center gap-2 rounded-full bg-white px-4 shadow-[0_4px_12px_rgba(31,42,36,.06)]">
              <Search className="size-4 text-neutral-400" />
              <input
                autoFocus
                value={data.keyQuery}
                onChange={(e) => data.setKeyQuery(e.target.value)}
                placeholder="Cari kode…"
                className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              />
            </div>
            <button onClick={close} aria-label="Tutup" className="grid size-12 place-items-center rounded-full bg-white">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-4" style={{ paddingBottom: SAFE_B }}>
            {keys.length === 0 && <p className="pt-10 text-center text-sm text-neutral-500">{data.loading ? "Mencari…" : "Tidak ada kode."}</p>}
            {keys.map((k) => (
              <div key={k.k} className="flex items-center gap-2 rounded-3xl bg-white p-2 pl-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[17px] font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    {k.k}
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium tracking-wider text-neutral-400">{statusOf(k, data.used)}</div>
                </div>
                <button onClick={() => copy(k.k)} aria-label="Salin" className="grid size-11 place-items-center rounded-full" style={{ background: "#eef3ec", color: SAGE }}>
                  <Copy className="size-4" />
                </button>
                <button onClick={() => open(k.k)} aria-label="Buka" className="grid size-11 place-items-center rounded-full text-white" style={{ background: SAGE }}>
                  <ExternalLink className="size-4" />
                </button>
              </div>
            ))}
            {data.hasMore && !data.keyQuery && (
              <button onClick={data.loadMore} className="h-12 w-full rounded-full bg-white text-sm font-medium">
                Muat lebih banyak
              </button>
            )}
          </div>
        </Sheet>
      )}

      {/* Quiz companion */}
      {sheet === "quiz" && (
        <Sheet full onClose={close} label="Kunci Jawaban">
          {!deck ? (
            <>
              <div className="px-4 pb-3 pt-[3.25rem]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Kunci Jawaban</h2>
                  <button onClick={close} aria-label="Tutup" className="grid size-11 place-items-center rounded-full bg-white">
                    <X className="size-5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="flex h-12 flex-1 items-center gap-2 rounded-full bg-white px-4 shadow-[0_4px_12px_rgba(31,42,36,.06)]">
                    <Search className="size-4 text-neutral-400" />
                    <input
                      autoFocus
                      value={data.answerQuery}
                      onChange={(e) => data.setAnswerQuery(e.target.value)}
                      placeholder="Ketik kata dari soal…"
                      className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
                    />
                  </div>
                  <button
                    onClick={startRandom}
                    className="flex h-12 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white"
                    style={{ background: TERRA }}
                  >
                    <Shuffle className="size-4" /> Acak
                  </button>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto px-4" style={{ paddingBottom: SAFE_B }}>
                <p className="px-1 text-xs text-neutral-500">
                  {data.answers.length} hasil{data.answers.length > 60 ? ", menampilkan 60 teratas" : ""}
                </p>
                {list.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setRand(false);
                      setDeck(list);
                      setPos(i);
                      setFlipped(false);
                    }}
                    className="block w-full rounded-3xl bg-white p-4 text-left shadow-[0_4px_12px_rgba(31,42,36,.05)] active:scale-[.99]"
                  >
                    <p className="text-[19px] font-semibold leading-snug" style={{ color: SAGE }}>
                      {a.a}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-neutral-500">{a.q}</p>
                  </button>
                ))}
                {list.length === 0 && <p className="pt-10 text-center text-sm text-neutral-500">Tidak ada soal yang cocok.</p>}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col px-4 pt-[3.25rem]" style={{ paddingBottom: SAFE_B }}>
              <div className="mb-3 flex items-center justify-between">
                <button onClick={() => { setDeck(null); setFlipped(false); }} className="flex h-11 items-center gap-1.5 rounded-full bg-white pl-3 pr-4 text-sm font-medium">
                  <ArrowLeft className="size-4" /> Daftar
                </button>
                <span className="text-sm tabular-nums text-neutral-500">
                  {rand ? `Latihan #${pos + 1}` : `${pos + 1} / ${deck.length}`}
                </span>
                <button onClick={close} aria-label="Tutup" className="grid size-11 place-items-center rounded-full bg-white">
                  <X className="size-5" />
                </button>
              </div>

              <button
                onClick={() => setFlipped((f) => !f)}
                className="relative flex flex-1 flex-col justify-center rounded-[28px] p-7 text-left shadow-[0_16px_28px_-14px_rgba(31,42,36,.35)] transition-colors duration-300"
                style={{ background: flipped ? SAGE : "#fff", color: flipped ? "#fff" : INK }}
              >
                <span className="absolute left-7 top-6 text-[11px] font-bold tracking-[.16em] opacity-60">
                  {flipped ? "JAWABAN" : "SOAL"}
                </span>
                <p className={cn("leading-snug", flipped ? "text-[30px] font-semibold" : "text-[21px] font-medium")}>
                  {flipped ? deck[pos].a : deck[pos].q}
                </p>
                {flipped && <p className="mt-5 text-[13px] leading-snug text-white/70">{deck[pos].q}</p>}
                <span className="absolute bottom-5 left-7 flex items-center gap-1.5 text-xs opacity-60">
                  <RotateCcw className="size-3.5" /> {flipped ? "Ketuk untuk kembali" : "Ketuk untuk lihat jawaban"}
                </span>
              </button>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => go(-1)}
                  disabled={pos === 0}
                  aria-label="Sebelumnya"
                  className="grid h-14 w-16 place-items-center rounded-full bg-white disabled:opacity-40"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  onClick={() => {
                    setRand(true);
                    setDeck([...deck.slice(0, pos + 1), pick()]);
                    setPos(pos + 1);
                    setFlipped(false);
                  }}
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white"
                  style={{ background: TERRA }}
                >
                  <Shuffle className="size-4" /> Acak
                </button>
                <button
                  onClick={() => go(1)}
                  disabled={!rand && pos >= deck.length - 1}
                  aria-label="Berikutnya"
                  className="grid h-14 w-16 place-items-center rounded-full text-white disabled:opacity-40"
                  style={{ background: SAGE }}
                >
                  <ChevronRight className="size-6" />
                </button>
              </div>
            </div>
          )}
        </Sheet>
      )}

      {/* Add sheet */}
      {sheet === "add" && (
        <Sheet onClose={close} label="Tambah kode">
          <div className="px-5 pt-5" style={{ paddingBottom: SAFE_B }}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-neutral-200" />
            {added == null ? (
              <>
                <h2 className="text-xl font-semibold">Tambah kode</h2>
                <p className="mt-1 text-sm text-neutral-500">Tempel banyak kode sekaligus, satu kode per baris.</p>
                <textarea
                  autoFocus
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  rows={6}
                  placeholder={"ABC123XYZ\nDEF456UVW"}
                  className="mt-4 w-full resize-none rounded-3xl p-4 text-base outline-none"
                  style={{ background: BG, fontFamily: "'IBM Plex Mono', monospace" }}
                />
                <button
                  onClick={submitAdd}
                  disabled={!raw.trim() || busy}
                  className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-white disabled:opacity-50"
                  style={{ background: SAGE }}
                >
                  {busy ? "Menyimpan…" : <>Simpan kode <ArrowRight className="size-5" /></>}
                </button>
              </>
            ) : (
              <div className="py-6 text-center">
                <div className="mx-auto grid size-20 place-items-center rounded-full text-white" style={{ background: SAGE }}>
                  <Check className="size-10" />
                </div>
                <h2 className="mt-4 text-2xl font-semibold">Jazakallahu khairan!</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {added} kode berhasil ditambahkan. Semoga bermanfaat untuk jamaah lain.
                </p>
                <div className="mt-6 flex gap-2">
                  <button onClick={() => { setAdded(null); setRaw(""); }} className="h-12 flex-1 rounded-full bg-neutral-100 font-medium">
                    Tambah lagi
                  </button>
                  <button onClick={close} className="h-12 flex-1 rounded-full font-semibold text-white" style={{ background: SAGE }}>
                    Selesai
                  </button>
                </div>
              </div>
            )}
          </div>
        </Sheet>
      )}

      {/* Report sheet */}
      {sheet === "report" && cur && (
        <Sheet onClose={close} label="Laporkan kode">
          <div className="px-5 pt-5" style={{ paddingBottom: SAFE_B }}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-neutral-200" />
            <div className="grid size-12 place-items-center rounded-2xl text-white" style={{ background: TERRA }}>
              <KeyRound className="size-6" />
            </div>
            <h2 className="mt-3 text-xl font-semibold">Laporkan kode tidak valid?</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Laporan ini berlaku untuk <b>semua pengguna</b>: kode akan hilang dari daftar semua orang.
            </p>
            <div className="mt-4 rounded-2xl p-4 text-center text-xl font-semibold" style={{ background: BG, fontFamily: "'IBM Plex Mono', monospace" }}>
              {cur.k}
            </div>
            <p className="mt-3 text-xs text-neutral-500">Pastikan sudah mencoba membukanya di Nusuk dan memang ditolak.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={close} className="h-14 flex-1 rounded-full bg-neutral-100 font-medium">
                Batal
              </button>
              <button
                onClick={() => {
                  data.markInvalid(cur.k);
                  setToast("Laporan terkirim");
                  setSheet(null);
                }}
                className="h-14 flex-[1.4] rounded-full font-semibold text-white"
                style={{ background: TERRA }}
              >
                Ya, laporkan
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
