// PROTOTYPE — throwaway. Variant A: "Focus flow" (wallet-style, one code at a time).
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Flag,
  KeyRound,
  ListChecks,
  Pin,
  Plus,
  Search,
  SkipForward,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "~/lib/utils";
import type { ProtoData, ProtoKey } from "./use-proto-data";

export const VARIANT_A_NAME = "Focus flow";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Manrope:wght@400;500;600;700;800&display=swap";
const SANS = "Manrope, ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

type Tab = "kode" | "jawaban" | "tambah";

function useCopied() {
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(null), 1500);
    return () => clearTimeout(id);
  }, [done]);
  return [done, setDone] as const;
}

export function VariantA({ data }: { data: ProtoData }) {
  const [tab, setTab] = useState<Tab>("kode");
  const [held, setHeld] = useState<string | null>(null); // key opened, awaiting check-in
  const [skipped, setSkipped] = useState<string[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useCopied();

  const pinned = data.keys.find((k) => k.pinned) ?? null;
  const ordered = useMemo(() => {
    const c = data.keys.filter((k) => !k.pinned && !k.invalid && (!data.used.has(k.k) || k.k === held));
    return [...c.filter((k) => !skipped.includes(k.k)), ...c.filter((k) => skipped.includes(k.k))];
  }, [data.keys, data.used, skipped, held]);
  const cur: ProtoKey | null = (held && ordered.find((k) => k.k === held)) || ordered[0] || null;
  const queue = ordered.filter((k) => k.k !== cur?.k).slice(0, 4);
  const n = data.used.size + (held ? 0 : 1);

  const copy = (k: string) => {
    void data.copy(k);
    setCopied(k);
  };
  const copyOpen = (k: string) => {
    data.openKey(k);
    copy(k);
    setHeld(k);
  };
  const skip = (k: string) => setSkipped((s) => [...s.filter((x) => x !== k), k]);
  const confirmInvalid = () => {
    if (!report) return;
    data.markInvalid(report, true);
    if (report === held) setHeld(null);
    setReport(null);
  };

  return (
    <div
      className="relative min-h-dvh bg-[#f5f8f7] text-[#0b1f1c] sm:min-h-[860px]"
      style={{ fontFamily: SANS }}
    >
      <link rel="stylesheet" href={FONT_URL} precedence="default" />

      <header className="px-5 pt-[calc(3.25rem+env(safe-area-inset-top))] pb-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#0f766e] uppercase">Nusuk Keys</p>
            <h1 className="text-[26px] leading-tight font-extrabold tracking-tight">
              {tab === "kode" ? "Kode berikutnya" : tab === "jawaban" ? "Kunci jawaban" : "Tambah kode"}
            </h1>
          </div>
          {tab === "kode" && (
            <span className="mb-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#0f766e] shadow-[0_1px_6px_rgba(15,118,110,.12)]">
              {data.validCount ?? "…"} tersedia
            </span>
          )}
        </div>
      </header>

      <main className="px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        {tab === "kode" && (
          <>
            {pinned && (
              <button
                onClick={() => copy(pinned.k)}
                className="mb-4 flex min-h-11 w-full items-center gap-2 rounded-2xl border border-dashed border-[#0f766e]/40 bg-white/70 px-3.5 text-left active:scale-[.99]"
              >
                <Pin className="size-4 shrink-0 text-[#0f766e]" />
                <span className="text-xs font-semibold text-[#0f766e]">Disematkan</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold" style={{ fontFamily: MONO }}>
                  {pinned.k}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {copied === pinned.k ? "Tersalin" : "Salin"}
                </span>
              </button>
            )}

            {cur ? (
              <div key={cur.k} className="animate-in fade-in slide-in-from-right-4 duration-300">
                <section className="relative overflow-hidden rounded-[28px] bg-[#0f766e] p-6 text-white shadow-[0_18px_40px_-14px_rgba(15,118,110,.55)]">
                  <div className="pointer-events-none absolute -top-16 -right-12 size-48 rounded-full bg-white/10" />
                  <div className="pointer-events-none absolute -bottom-20 -left-10 size-52 rounded-full bg-black/10" />
                  <div className="relative">
                    <div className="flex items-center justify-between text-xs font-semibold text-white/75">
                      <span>
                        Kode ke-{n} dari {data.validCount ?? "…"} tersedia
                      </span>
                      <KeyRound className="size-4" />
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-500"
                        style={{ width: `${Math.min(100, (n / Math.max(1, data.validCount ?? n)) * 100)}%` }}
                      />
                    </div>
                    <p
                      className="my-9 text-center text-[34px] leading-tight font-bold tracking-wider break-all"
                      style={{ fontFamily: MONO }}
                    >
                      {cur.k}
                    </p>

                    {!held ? (
                      <>
                        <button
                          onClick={() => copyOpen(cur.k)}
                          className="flex min-h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-white text-lg font-extrabold text-[#0f766e] shadow-lg transition active:scale-[.98]"
                        >
                          <ExternalLink className="size-5" /> Salin &amp; Buka
                        </button>
                        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                          <button
                            onClick={() => copy(cur.k)}
                            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/15 text-sm font-bold active:bg-white/25"
                          >
                            {copied === cur.k ? <Check className="size-4" /> : <Copy className="size-4" />}
                            {copied === cur.k ? "Tersalin" : "Salin saja"}
                          </button>
                          <button
                            onClick={() => skip(cur.k)}
                            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/15 text-sm font-bold active:bg-white/25"
                          >
                            <SkipForward className="size-4" /> Lewati
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="animate-in fade-in zoom-in-95 duration-200">
                        <p className="mb-3 text-center text-base font-extrabold">Berhasil dipakai?</p>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            onClick={() => setHeld(null)}
                            className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-white text-base font-extrabold text-[#0f766e] active:scale-[.98]"
                          >
                            <Check className="size-5" /> Berhasil
                          </button>
                          <button
                            onClick={() => setReport(cur.k)}
                            className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-[#064e48] text-base font-extrabold active:scale-[.98]"
                          >
                            <X className="size-5" /> Ditolak
                          </button>
                        </div>
                        <button
                          onClick={() => data.openKey(cur.k)}
                          className="mt-2.5 min-h-11 w-full text-sm font-semibold text-white/80 underline-offset-4 active:underline"
                        >
                          Buka lagi
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <div className="rounded-[28px] bg-white p-8 text-center shadow-sm">
                {data.loading ? (
                  <p className="font-semibold text-slate-500">Memuat kode…</p>
                ) : data.failed ? (
                  <>
                    <p className="font-bold">Gagal memuat kode</p>
                    <button
                      onClick={data.retry}
                      className="mt-4 min-h-12 rounded-xl bg-[#0f766e] px-6 font-bold text-white"
                    >
                      Coba lagi
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-extrabold">Semua kode sudah terpakai</p>
                    <p className="mt-1 text-sm text-slate-500">Tambahkan kode baru di tab Tambah.</p>
                  </>
                )}
              </div>
            )}

            {/* Antrean */}
            {queue.length > 0 && (
              <section className="mt-5 rounded-3xl bg-white shadow-[0_1px_10px_rgba(11,31,28,.06)]">
                <button
                  onClick={() => setQueueOpen((o) => !o)}
                  className="flex min-h-14 w-full items-center justify-between px-5 text-left"
                >
                  <span className="font-extrabold">
                    Antrean <span className="font-semibold text-slate-400">· {queue.length} berikutnya</span>
                  </span>
                  <ChevronDown className={cn("size-5 text-slate-400 transition", queueOpen && "rotate-180")} />
                </button>
                {queueOpen && (
                  <ul className="animate-in fade-in slide-in-from-top-1 border-t border-slate-100 px-2 pb-2 duration-200">
                    {queue.map((k, i) => (
                      <li key={k.k}>
                        <button
                          onClick={() => copy(k.k)}
                          className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left active:bg-slate-50"
                        >
                          <span className="w-4 text-xs font-bold text-slate-300">{i + 1}</span>
                          <span className="flex-1 truncate text-sm font-bold" style={{ fontFamily: MONO }}>
                            {k.k}
                          </span>
                          <span className="text-xs font-semibold text-[#0f766e]">
                            {copied === k.k ? "Tersalin" : "Salin"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <button
              onClick={() => setAllOpen(true)}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-[#0f766e] active:bg-[#0f766e]/10"
            >
              <ListChecks className="size-4" /> Lihat semua
            </button>
          </>
        )}

        {tab === "jawaban" && <Answers data={data} />}
        {tab === "tambah" && <AddKeys data={data} />}
      </main>

      {/* Tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="grid grid-cols-3">
          {(
            [
              ["kode", "Kode", KeyRound],
              ["jawaban", "Jawaban", BookOpen],
              ["tambah", "Tambah", Plus],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold transition",
                tab === id ? "text-[#0f766e]" : "text-slate-400",
              )}
            >
              <span className={cn("rounded-full px-5 py-1 transition", tab === id && "bg-[#0f766e]/10")}>
                <Icon className="size-5" />
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* All codes sheet */}
      {allOpen && (
        <div className="animate-in fade-in slide-in-from-bottom-6 fixed inset-0 z-40 flex flex-col bg-[#f5f8f7] duration-200">
          <div className="px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold">Semua kode</h2>
              <button
                onClick={() => setAllOpen(false)}
                className="grid size-11 place-items-center rounded-full bg-white shadow-sm"
                aria-label="Tutup"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={data.keyQuery}
                onChange={(e) => data.setKeyQuery(e.target.value)}
                placeholder="Cari kode…"
                className="h-12 w-full rounded-2xl bg-white pr-4 pl-11 text-base shadow-sm outline-none focus:ring-2 focus:ring-[#0f766e]/40"
              />
            </div>
          </div>
          <ul className="flex-1 space-y-1.5 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {data.keys.map((k) => {
              const used = data.used.has(k.k);
              return (
                <li key={k.k} className="flex items-center gap-1 rounded-2xl bg-white pl-4 shadow-sm">
                  <div className="min-w-0 flex-1 py-2">
                    <p
                      className={cn("truncate text-sm font-bold", used && "text-slate-400 line-through")}
                      style={{ fontFamily: MONO }}
                    >
                      {k.k}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      {k.pinned ? "Disematkan" : used ? "Sudah dipakai" : `#${k.no}`}
                    </p>
                  </div>
                  <IconBtn label="Salin" onClick={() => copy(k.k)}>
                    {copied === k.k ? <Check className="size-4 text-[#0f766e]" /> : <Copy className="size-4" />}
                  </IconBtn>
                  <IconBtn label="Buka" onClick={() => data.openKey(k.k)}>
                    <ExternalLink className="size-4" />
                  </IconBtn>
                  {!k.pinned && (
                    <IconBtn label="Tidak valid" onClick={() => setReport(k.k)}>
                      <Flag className="size-4" />
                    </IconBtn>
                  )}
                </li>
              );
            })}
            {data.loading && <li className="py-4 text-center text-sm text-slate-400">Memuat…</li>}
            {!data.loading && data.keys.length === 0 && (
              <li className="py-8 text-center text-sm text-slate-400">Tidak ada kode.</li>
            )}
            {data.hasMore && (
              <li>
                <button
                  onClick={data.loadMore}
                  className="min-h-12 w-full rounded-2xl bg-white text-sm font-bold text-[#0f766e] shadow-sm"
                >
                  Muat lebih banyak
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Report-invalid bottom sheet */}
      {report && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            aria-label="Batal"
            onClick={() => setReport(null)}
            className="animate-in fade-in absolute inset-0 bg-black/45 duration-200"
          />
          <div className="animate-in slide-in-from-bottom-10 relative rounded-t-[28px] bg-white px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] duration-200">
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-slate-200" />
            <h3 className="text-xl font-extrabold">Laporkan kode tidak valid?</h3>
            <p className="mt-1 text-sm text-slate-500">
              Kode ini akan disembunyikan untuk <b>semua pengguna</b>. Hanya laporkan jika Nusuk menolaknya.
            </p>
            <p
              className="my-4 rounded-2xl bg-slate-100 py-3 text-center text-lg font-bold break-all"
              style={{ fontFamily: MONO }}
            >
              {report}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setReport(null)}
                className="min-h-14 rounded-2xl bg-slate-100 font-bold active:scale-[.98]"
              >
                Batal
              </button>
              <button
                onClick={confirmInvalid}
                className="min-h-14 rounded-2xl bg-rose-600 font-extrabold text-white active:scale-[.98]"
              >
                Ya, laporkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-500 active:bg-slate-100"
    >
      {children}
    </button>
  );
}

function Answers({ data }: { data: ProtoData }) {
  const [shown, setShown] = useState(60);
  useEffect(() => setShown(60), [data.answerQuery]);
  const list = data.answers.slice(0, shown);
  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 bg-[#f5f8f7]/95 px-5 pb-3 backdrop-blur">
        <div className="relative">
          <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#0f766e]" />
          <input
            value={data.answerQuery}
            onChange={(e) => data.setAnswerQuery(e.target.value)}
            placeholder="Ketik kata dari soal…"
            inputMode="search"
            className="h-14 w-full rounded-2xl bg-white pr-12 pl-12 text-base font-semibold shadow-[0_2px_14px_rgba(15,118,110,.12)] outline-none focus:ring-2 focus:ring-[#0f766e]/50"
          />
          {data.answerQuery && (
            <button
              aria-label="Hapus"
              onClick={() => data.setAnswerQuery("")}
              className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center text-slate-400"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        <p className="mt-2 px-1 text-xs font-semibold text-slate-400">
          {data.answers.length} dari {data.answersTotal} jawaban
        </p>
      </div>
      <ul className="space-y-3">
        {list.map((a) => (
          <li key={a.id} className="rounded-3xl bg-white p-5 shadow-[0_1px_10px_rgba(11,31,28,.06)]">
            <p className="text-[22px] leading-snug font-extrabold tracking-tight text-[#0f766e]">{a.a}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{a.q}</p>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-10 text-center text-sm font-semibold text-slate-400">Tidak ada hasil.</li>
        )}
      </ul>
      {shown < data.answers.length && (
        <button
          onClick={() => setShown((s) => s + 60)}
          className="mt-4 min-h-12 w-full rounded-2xl bg-white font-bold text-[#0f766e] shadow-sm"
        >
          Tampilkan lagi
        </button>
      )}
    </div>
  );
}

function AddKeys({ data }: { data: ProtoData }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const lines = text.split(/\s+/).filter(Boolean).length;
  const submit = async () => {
    setBusy(true);
    setResult(await data.addKeys(text));
    setBusy(false);
    setText("");
  };
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">Tempel banyak kode sekaligus, satu kode per baris.</p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        rows={9}
        placeholder={"KODE-001\nKODE-002\nKODE-003"}
        className="w-full resize-none rounded-3xl bg-white p-5 text-base shadow-[0_1px_10px_rgba(11,31,28,.06)] outline-none focus:ring-2 focus:ring-[#0f766e]/40"
        style={{ fontFamily: MONO }}
      />
      <button
        onClick={submit}
        disabled={!lines || busy}
        className="mt-3 min-h-14 w-full rounded-2xl bg-[#0f766e] text-base font-extrabold text-white shadow-lg transition active:scale-[.98] disabled:opacity-40"
      >
        {busy ? "Menyimpan…" : lines ? `Tambah ${lines} kode` : "Tambah kode"}
      </button>
      {result !== null && (
        <p className="animate-in fade-in mt-4 flex items-center gap-2 rounded-2xl bg-[#0f766e]/10 px-4 py-3 text-sm font-bold text-[#0f766e]">
          <Check className="size-4" /> {result} kode berhasil ditambahkan
        </p>
      )}
    </div>
  );
}
