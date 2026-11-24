import answersStrings from "./i18n-answers.json";
import keysStrings from "./i18n-keys.json";

export type Lang = "id" | "en" | "ar" | "ms" | "tr" | "ur" | "fr" | "es";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "id", label: "Indonesia" },
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
  { code: "ms", label: "Melayu" },
  { code: "tr", label: "Türkçe" },
  { code: "ur", label: "اردو" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
];

export const RTL: Partial<Record<Lang, true>> = { ar: true, ur: true };
export const LANG_LS = "nusukkey.lang.v1";

type Dict = Record<string, string>;
export const KEYS_I18N = keysStrings as Record<Lang, Dict>;
export const ANSWERS_I18N = answersStrings as Record<Lang, Dict>;

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && LANGS.some((l) => l.code === v);
}

/** Saved choice wins; otherwise always Bahasa Indonesia (browser language is ignored). Client only. */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_LS);
    if (isLang(saved)) return saved;
  } catch {}
  return "id";
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function makeT(table: Record<Lang, Dict>, lang: Lang): TFn {
  return (key, vars) => {
    let s = table[lang]?.[key] ?? table.id?.[key] ?? table.en?.[key] ?? key;
    if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
    return s;
  };
}

export function fmtNumber(n: number, lang: Lang) {
  try {
    return n.toLocaleString(lang === "ar" || lang === "ur" ? "en-US" : lang);
  } catch {
    return String(n);
  }
}

export function applyDocumentLang(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL[lang] ? "rtl" : "ltr";
}
