// PROTOTYPE — throwaway. Floating variant switcher; never rendered in production builds.
import { useEffect } from "react";

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: {
  variants: { key: string; name: string }[];
  current: string;
  onChange: (key: string) => void;
}) {
  const idx = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );
  const go = (d: number) => onChange(variants[(idx + d + variants.length) % variants.length].key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;
  const v = variants[idx];
  return (
    <div
      style={{ fontFamily: "ui-sans-serif, system-ui", zIndex: 2147483647 }}
      className="fixed top-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#ff2d55] px-1 py-1 text-xs font-semibold text-white shadow-[0_6px_24px_rgba(0,0,0,.35)] ring-2 ring-white"
    >
      <button className="grid size-7 place-items-center rounded-full hover:bg-white/20" onClick={() => go(-1)} aria-label="Previous variant">
        ←
      </button>
      <span className="px-2 whitespace-nowrap">
        PROTOTYPE {v.key} · {v.name}
      </span>
      <button className="grid size-7 place-items-center rounded-full hover:bg-white/20" onClick={() => go(1)} aria-label="Next variant">
        →
      </button>
    </div>
  );
}
