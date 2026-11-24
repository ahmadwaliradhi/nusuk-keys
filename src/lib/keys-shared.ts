export const KEY_RE = /^[A-Za-z0-9_-]{5,40}$/;
export const OPEN_BASE = "https://services.nusuk.sa/app/?p=27&id=";

/** Accepts a bare key or a full link containing `id=`. Returns null when unusable. */
export function normalizeKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 400) return null;
  const m = s.match(/[?&]id=([A-Za-z0-9_-]{3,40})/);
  if (m) return KEY_RE.test(m[1]) ? m[1] : null;
  return KEY_RE.test(s) ? s : null;
}
export const PINNED_KEY = "NG-r8BBCPN4";
