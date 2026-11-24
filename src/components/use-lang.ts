import { useEffect, useMemo, useState } from "react";
import { applyDocumentLang, detectLang, fmtNumber, LANG_LS, makeT, type Lang } from "~/lib/i18n";

export function useLang(table: Parameters<typeof makeT>[0]) {
  const [lang, setLangState] = useState<Lang>("id");
  useEffect(() => {
    const l = detectLang();
    setLangState(l);
    applyDocumentLang(l);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_LS, l);
    } catch {}
    applyDocumentLang(l);
  };
  const t = useMemo(() => makeT(table, lang), [table, lang]);
  const fmt = useMemo(() => (n: number) => fmtNumber(n, lang), [lang]);
  return { lang, setLang, t, fmt };
}
