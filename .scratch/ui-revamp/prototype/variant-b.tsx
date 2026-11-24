// PROTOTYPE — throwaway. Variant B: dark, dense, gesture-driven ledger.
import { Check, ChevronDown, Copy, Ellipsis, ExternalLink, Flag, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import type { ProtoData, ProtoKey } from "./use-proto-data";

export const VARIANT_B_NAME = "Dark ledger";

const ACCENT = "#c6f432";
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const SANS = '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif';
const SWIPE_AT = 72;
const buzz = (ms = 10) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};

type Filter = "all" | "fresh" | "used";
type Sheet = { t: "menu" | "report"; k: string } | { t: "add" } | null;

function Hl({ text, q, tone }: { text: string; q: string; tone: "lime" | "white" }) {
  const t = q.trim();
  if (!t) return <>{text}</>;
  const parts = text.split(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <mark
            key={i}
            className="rounded-[2px] px-0.5 text-black"
            style={{ background: tone === "lime" ? ACCENT : "#fff" }}
          >
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <rect x="0" y="0" width="22" height="22" rx="5" fill={ACCENT} />
      <rect x="4" y="5" width="14" height="2.4" rx="1.2" fill="#0b0b0c" />
      <rect x="4" y="9.8" width="9" height="2.4" rx="1.2" fill="#0b0b0c" />
      <rect x="4" y="14.6" width="11.5" height="2.4" rx="1.2" fill="#0b0b0c" />
    </svg>
  );
}

function Row({
  item,
  used,
  flash,
  onCopy,
  onOpen,
  onToggle,
  onReport,
  onMenu,
}: {
  item: ProtoKey;
  used: boolean;
  flash: boolean;
  onCopy: () => void;
  onOpen: () => void;
  onToggle: () => void;
  onReport: () => void;
  onMenu: () => void;
}) {
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const g = useRef({ sx: 0, sy: 0, on: false, moved: false, long: false, armed: false, timer: 0 });

  const clear = () => window.clearTimeout(g.current.timer);
  const reset = () => {
    clear();
    g.current.on = false;
    setDrag(false);
    setX(0);
  };

  const down = (e: React.PointerEvent) => {
    const s = g.current;
    s.sx = e.clientX;
    s.sy = e.clientY;
    s.on = false;
    s.moved = false;
    s.long = false;
    s.armed = false;
    clear();
    s.timer = window.setTimeout(() => {
      if (!s.moved) {
        s.long = true;
        buzz(18);
        onMenu();
      }
    }, 480);
  };
  const move = (e: React.PointerEvent) => {
    const s = g.current;
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    if (!s.on) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        s.moved = true;
        clear();
      }
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        s.on = true;
        setDrag(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else return;
    }
    const lim = item.pinned ? 0 : -130;
    const nx = Math.max(lim, Math.min(130, dx));
    const armed = Math.abs(nx) >= SWIPE_AT;
    if (armed && !s.armed) buzz(8);
    s.armed = armed;
    setX(nx);
  };
  const up = () => {
    const s = g.current;
    clear();
    if (s.on) {
      if (x >= SWIPE_AT) onToggle();
      else if (x <= -SWIPE_AT) onReport();
    } else if (!s.moved && !s.long) {
      buzz(10);
      onCopy();
    }
    s.on = false;
    setDrag(false);
    setX(0);
  };

  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const pct = Math.min(1, Math.abs(x) / SWIPE_AT);

  return (
    <li className="relative overflow-hidden border-b border-white/[0.07]">
      <div
        className="absolute inset-0 flex items-center justify-start pl-5 text-[13px] font-semibold text-black"
        style={{ background: ACCENT, opacity: x > 0 ? 0.25 + pct * 0.75 : 0, fontFamily: MONO }}
      >
        <Check size={16} className="mr-2" />
        {used ? "Belum dipakai" : "Dipakai"}
      </div>
      <div
        className="absolute inset-0 flex items-center justify-end pr-5 text-[13px] font-semibold text-white"
        style={{ background: "#e5384f", opacity: x < 0 ? 0.25 + pct * 0.75 : 0, fontFamily: MONO }}
      >
        Laporkan
        <Flag size={16} className="ml-2" />
      </div>

      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={reset}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "relative flex h-[58px] select-none items-center gap-2.5 bg-[#0b0b0c] pl-4 pr-1 active:bg-[#131315]",
          !drag && "transition-transform duration-200",
        )}
        style={{ transform: `translateX(${x}px)`, touchAction: "pan-y", WebkitTouchCallout: "none" }}
      >
        <span className="w-7 shrink-0 text-[10px] text-white/30" style={{ fontFamily: MONO }}>
          {String(item.no).padStart(3, "0")}
        </span>
        <span
          className={cn("size-2 shrink-0 rounded-full", item.pinned && "ring-2 ring-offset-2 ring-offset-[#0b0b0c]")}
          style={{
            background: used ? "transparent" : ACCENT,
            border: used ? "1.5px solid rgba(255,255,255,.3)" : "none",
            // @ts-expect-error css var for ring colour
            "--tw-ring-color": ACCENT,
          }}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[17px] font-medium tracking-tight",
            used ? "text-white/35" : "text-[#f1f1ec]",
          )}
          style={{ fontFamily: MONO }}
        >
          {item.k}
        </span>
        {item.pinned && (
          <span
            className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold tracking-widest text-black"
            style={{ background: ACCENT, fontFamily: MONO }}
          >
            PIN
          </span>
        )}
        <button
          type="button"
          onPointerDown={stop}
          onClick={onOpen}
          className="flex h-11 shrink-0 items-center active:scale-95"
          aria-label={`Buka ${item.k}`}
        >
          <span
            className="flex h-8 items-center gap-1 rounded-full border px-3 text-[12px] font-semibold"
            style={{ borderColor: used ? "rgba(255,255,255,.18)" : ACCENT, color: used ? "rgba(255,255,255,.5)" : ACCENT }}
          >
            Buka <ExternalLink size={12} />
          </span>
        </button>
        <button
          type="button"
          onPointerDown={stop}
          onClick={onMenu}
          className="flex size-11 shrink-0 items-center justify-center text-white/40 active:scale-90 active:text-white"
          aria-label="Aksi lainnya"
        >
          <Ellipsis size={18} />
        </button>
      </div>

      {flash && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-[13px] font-bold tracking-widest text-black"
          style={{ background: ACCENT, fontFamily: MONO, animation: "vb-flash 900ms ease-out forwards" }}
        >
          <Check size={16} strokeWidth={3} /> TERSALIN
        </div>
      )}
    </li>
  );
}

function SheetFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ animation: "vb-fade 160ms ease-out" }}>
      <button type="button" aria-label="Tutup" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative rounded-t-[22px] border-t border-white/10 bg-[#141416] px-4 pt-2"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          animation: "vb-up 220ms cubic-bezier(.2,.9,.3,1)",
        }}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/20" />
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/50" style={{ fontFamily: MONO }}>
            {title}
          </h2>
          <button type="button" onClick={onClose} className="-mr-2 flex size-11 items-center justify-center text-white/50 active:scale-90">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[54px] w-full items-center gap-3 border-b border-white/[0.07] text-left text-[16px] font-medium active:bg-white/5",
        danger ? "text-[#ff6b7e]" : "text-[#f1f1ec]",
      )}
    >
      <span className="flex size-6 items-center justify-center opacity-80">{icon}</span>
      {label}
    </button>
  );
}

export function VariantB({ data }: { data: ProtoData }) {
  const [mode, setMode] = useState<"kode" | "jawaban">("kode");
  const [filter, setFilter] = useState<Filter>("all");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(60);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const more = useRef<() => void>(() => {});
  const toastT = useRef(0);

  const say = (m: string) => {
    setToast(m);
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(null), 1700);
  };

  const q = mode === "kode" ? data.keyQuery : data.answerQuery;
  const setQ = mode === "kode" ? data.setKeyQuery : data.setAnswerQuery;

  useEffect(() => setLimit(60), [data.answerQuery]);

  const visible = data.keys
    .filter((i) => !i.invalid)
    .filter((i) => i.pinned || filter === "all" || (filter === "used") === data.used.has(i.k));
  const shownAnswers = data.answers.slice(0, limit);

  more.current =
    mode === "kode"
      ? data.hasMore && !data.loading
        ? data.loadMore
        : () => {}
      : limit < data.answers.length
        ? () => setLimit((l) => l + 60)
        : () => {};

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && more.current(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [mode, data.keys.length, data.loading, data.hasMore, limit, filter]);

  const copy = (k: string) => {
    void data.copy(k);
    setFlash(k);
    window.setTimeout(() => setFlash((f) => (f === k ? null : f)), 900);
  };
  const lines = draft.split(/\s+/).filter(Boolean).length;
  const usedCount = data.used.size;
  const menuKey = sheet && sheet.t !== "add" ? data.keys.find((i) => i.k === sheet.k) : undefined;

  const chip = (id: Filter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => {
        buzz(6);
        setFilter(id);
      }}
      className={cn(
        "h-9 rounded-full border px-3.5 text-[13px] font-medium active:scale-95",
        filter === id ? "border-transparent text-black" : "border-white/15 text-white/60",
      )}
      style={filter === id ? { background: ACCENT } : undefined}
    >
      {label}
    </button>
  );

  return (
    <div
      className="relative min-h-dvh bg-[#0b0b0c] text-[#f1f1ec] sm:min-h-[860px]"
      style={{ fontFamily: SANS }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Bricolage+Grotesque:wght@400;600;700;800&display=swap"
        precedence="default"
      />
      <style>{`
        @keyframes vb-flash{0%{opacity:1}60%{opacity:1}100%{opacity:0}}
        @keyframes vb-up{from{transform:translateY(100%)}to{transform:none}}
        @keyframes vb-fade{from{opacity:0}to{opacity:1}}
        @keyframes vb-pop{from{opacity:0;transform:translate(-50%,8px) scale(.96)}to{opacity:1;transform:translate(-50%,0)}}
        @keyframes vb-pulse{0%,100%{opacity:1}50%{opacity:.35}}
      `}</style>

      {/* header */}
      <header
        className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0b0b0c]/92 px-4 pb-2.5 backdrop-blur"
        style={{ paddingTop: "max(3.25rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mark />
            <span className="text-[17px] font-bold tracking-tight">
              nusuk<span style={{ color: ACCENT }}>/</span>keys
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-white/55"
            style={{ fontFamily: MONO }}
          >
            <span className="size-1.5 rounded-full" style={{ background: ACCENT, animation: "vb-pulse 2s infinite" }} />
            <span style={{ color: ACCENT }}>{data.validCount ?? "—"}</span> tersedia
            <span className="text-white/25">·</span>
            <span className="text-white">{usedCount}</span> dipakai
          </div>
        </div>
        {mode === "kode" && <div className="mt-2.5 flex gap-2">{[chip("all", "Semua"), chip("fresh", "Belum dipakai"), chip("used", "Dipakai")]}</div>}
      </header>

      {/* body */}
      <main style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 230px)" }}>
        {mode === "kode" ? (
          <>
            {data.failed && (
              <div className="m-4 flex items-center justify-between rounded-lg border border-[#e5384f]/40 bg-[#e5384f]/10 px-3 py-2 text-[13px] text-[#ff8b9a]">
                Gagal memuat kode.
                <button type="button" onClick={data.retry} className="h-11 px-3 font-semibold underline">
                  Coba lagi
                </button>
              </div>
            )}
            <ul>
              {visible.map((item) => (
                <Row
                  key={item.k}
                  item={item}
                  used={data.used.has(item.k)}
                  flash={flash === item.k}
                  onCopy={() => copy(item.k)}
                  onOpen={() => data.openKey(item.k)}
                  onToggle={() => {
                    buzz(14);
                    data.toggleUsed(item.k);
                    say(data.used.has(item.k) ? "Ditandai belum dipakai" : "Ditandai dipakai");
                  }}
                  onReport={() => setSheet({ t: "report", k: item.k })}
                  onMenu={() => setSheet({ t: "menu", k: item.k })}
                />
              ))}
            </ul>
            {data.loading &&
              Array.from({ length: visible.length ? 2 : 8 }).map((_, i) => (
                <div key={i} className="flex h-[58px] items-center gap-3 border-b border-white/[0.07] px-4">
                  <div className="h-2.5 w-6 rounded bg-white/10" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-white/[0.06]" />
                </div>
              ))}
            {!data.loading && !data.failed && visible.length === 0 && (
              <p className="px-6 py-16 text-center text-[14px] text-white/40" style={{ fontFamily: MONO }}>
                {data.keyQuery ? `Tidak ada kode untuk “${data.keyQuery}”` : "Tidak ada kode di filter ini"}
              </p>
            )}
            {!data.hasMore && visible.length > 8 && (
              <p className="py-6 text-center text-[11px] uppercase tracking-[0.2em] text-white/25" style={{ fontFamily: MONO }}>
                — akhir daftar —
              </p>
            )}
            {visible.length > 0 && (
              <p className="px-4 pt-3 text-[11px] text-white/25" style={{ fontFamily: MONO }}>
                ketuk = salin · geser kanan = dipakai · geser kiri = laporkan · tahan = menu
              </p>
            )}
          </>
        ) : (
          <>
            <p className="px-4 pb-1 pt-3 text-[11px] uppercase tracking-[0.16em] text-white/35" style={{ fontFamily: MONO }}>
              Kunci jawaban · {data.answers.length}/{data.answersTotal}
            </p>
            <ul>
              {shownAnswers.map((a) => {
                const isOpen = open === a.id;
                return (
                  <li key={a.id} className="border-b border-white/[0.07]">
                    <button
                      type="button"
                      onClick={() => {
                        buzz(6);
                        setOpen(isOpen ? null : a.id);
                      }}
                      className="flex min-h-[56px] w-full items-start gap-3 px-4 py-3.5 text-left active:bg-white/[0.03]"
                    >
                      <span className="flex-1 text-[15px] font-medium leading-snug">
                        <Hl text={a.q} q={data.answerQuery} tone="lime" />
                      </span>
                      <ChevronDown
                        size={18}
                        className={cn("mt-0.5 shrink-0 text-white/40 transition-transform", isOpen && "rotate-180")}
                      />
                    </button>
                    {isOpen && (
                      <div className="mx-4 mb-3.5 border-l-2 pl-3" style={{ borderColor: ACCENT, animation: "vb-fade 160ms" }}>
                        <p className="text-[16px] font-semibold leading-snug" style={{ color: ACCENT }}>
                          <Hl text={a.a} q={data.answerQuery} tone="white" />
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {data.answers.length === 0 && (
              <p className="px-6 py-16 text-center text-[14px] text-white/40" style={{ fontFamily: MONO }}>
                Tidak ada jawaban untuk “{data.answerQuery}”
              </p>
            )}
            {limit < data.answers.length && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + 60)}
                className="mx-auto mt-3 block h-11 px-5 text-[13px] text-white/50 underline"
              >
                Tampilkan lebih banyak
              </button>
            )}
          </>
        )}
        <div ref={sentinel} className="h-px" />
      </main>

      {/* toast */}
      {toast && (
        <div
          className="fixed left-1/2 z-40 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black shadow-lg"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 138px)",
            fontFamily: MONO,
            animation: "vb-pop 160ms ease-out",
          }}
        >
          {toast}
        </div>
      )}

      {/* FAB */}
      {mode === "kode" && (
        <button
          type="button"
          onClick={() => setSheet({ t: "add" })}
          aria-label="Tambah kode"
          className="fixed right-4 z-40 flex size-[52px] items-center justify-center rounded-full text-black shadow-[0_8px_24px_rgba(198,244,50,.28)] active:scale-90"
          style={{ background: ACCENT, bottom: "calc(env(safe-area-inset-bottom, 0px) + 132px)" }}
        >
          <Plus size={26} strokeWidth={2.6} />
        </button>
      )}

      {/* dock */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0b0c]/95 px-3 pt-2.5 backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
      >
        <div className="flex h-12 items-center gap-2 rounded-xl border border-white/12 bg-[#151517] px-3 focus-within:border-[#c6f432]/70">
          <Search size={18} className="shrink-0 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={mode === "kode" ? "Cari kode…" : "Cari pertanyaan atau jawaban…"}
            inputMode="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-[#f1f1ec] outline-none placeholder:text-white/30"
            style={{ fontFamily: mode === "kode" ? MONO : SANS }}
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Hapus" className="-mr-2 flex size-11 items-center justify-center text-white/50 active:scale-90">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="mt-2 grid h-11 grid-cols-2 rounded-xl bg-[#151517] p-1">
          {(["kode", "jawaban"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                buzz(6);
                setMode(m);
              }}
              className={cn(
                "rounded-lg text-[13px] font-semibold uppercase tracking-[0.14em] active:scale-[.97]",
                mode === m ? "text-black" : "text-white/50",
              )}
              style={{ fontFamily: MONO, background: mode === m ? ACCENT : "transparent" }}
            >
              {m === "kode" ? "Kode" : "Jawaban"}
            </button>
          ))}
        </div>
      </div>

      {/* sheets */}
      {sheet?.t === "menu" && menuKey && (
        <SheetFrame title={menuKey.k} onClose={() => setSheet(null)}>
          <ActionRow
            icon={<Copy size={20} />}
            label="Salin kode"
            onClick={() => {
              copy(menuKey.k);
              setSheet(null);
            }}
          />
          <ActionRow
            icon={<ExternalLink size={20} />}
            label="Buka di Nusuk"
            onClick={() => {
              data.openKey(menuKey.k);
              setSheet(null);
            }}
          />
          <ActionRow
            icon={<Check size={20} />}
            label={data.used.has(menuKey.k) ? "Tandai belum dipakai" : "Tandai dipakai"}
            onClick={() => {
              data.toggleUsed(menuKey.k);
              setSheet(null);
            }}
          />
          {!menuKey.pinned && (
            <ActionRow
              danger
              icon={<Flag size={20} />}
              label="Laporkan tidak valid"
              onClick={() => setSheet({ t: "report", k: menuKey.k })}
            />
          )}
        </SheetFrame>
      )}

      {sheet?.t === "report" && (
        <SheetFrame title="Laporkan tidak valid" onClose={() => setSheet(null)}>
          <p className="text-[22px] font-medium" style={{ fontFamily: MONO }}>
            {sheet.k}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-white/60">
            Kode ini akan disembunyikan untuk <b className="text-white">semua pengguna</b>. Laporkan hanya jika sudah dicoba dan memang
            ditolak.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSheet(null)} className="h-12 rounded-xl border border-white/15 text-[15px] font-semibold active:scale-[.97]">
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                data.markInvalid(sheet.k);
                buzz(20);
                setSheet(null);
                say("Dilaporkan tidak valid");
              }}
              className="h-12 rounded-xl bg-[#e5384f] text-[15px] font-bold text-white active:scale-[.97]"
            >
              Ya, laporkan
            </button>
          </div>
        </SheetFrame>
      )}

      {sheet?.t === "add" && (
        <SheetFrame title="Tambah kode" onClose={() => setSheet(null)}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={"Tempel kode, satu per baris\nABC123\nDEF456"}
            rows={6}
            autoCapitalize="off"
            spellCheck={false}
            className="w-full resize-none rounded-xl border border-white/12 bg-[#0b0b0c] p-3 text-[16px] leading-relaxed outline-none placeholder:text-white/25 focus:border-[#c6f432]/70"
            style={{ fontFamily: MONO }}
          />
          <button
            type="button"
            disabled={!lines || saving}
            onClick={async () => {
              setSaving(true);
              const n = await data.addKeys(draft);
              setSaving(false);
              setDraft("");
              setSheet(null);
              say(`${n} kode ditambahkan`);
            }}
            className="mt-3 h-12 w-full rounded-xl text-[15px] font-bold text-black active:scale-[.98] disabled:opacity-35"
            style={{ background: ACCENT }}
          >
            {saving ? "Menyimpan…" : lines ? `Tambah ${lines} kode` : "Tambah kode"}
          </button>
        </SheetFrame>
      )}
    </div>
  );
}
