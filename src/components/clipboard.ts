import { useCallback, useEffect, useRef, useState } from "react";

function fallbackCopy(text: string) {
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.top = "-1000px";
  document.body.appendChild(el);
  el.select();
  try {
    document.execCommand("copy");
  } catch {}
  document.body.removeChild(el);
}

/** Starts the copy synchronously (keeps the user gesture); resolves once it settled. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
  }
  fallbackCopy(text);
}

/** `copied` holds the last copied text for a moment, so UI can flip a "Copied" label. */
export function useCopied(ms = 1500) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const copy = useCallback(
    (text: string) => {
      void copyText(text).then(() => {
        setCopied(text);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(null), ms);
      });
    },
    [ms],
  );
  return { copied, copy };
}
