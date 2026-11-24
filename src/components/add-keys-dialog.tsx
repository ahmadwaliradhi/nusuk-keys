import { Check, Download, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { CSV_MAX_BYTES, downloadCsvTemplate, parseKeyCsv } from "~/components/csv-keys";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import type { TFn } from "~/lib/i18n";
import { normalizeKey } from "~/lib/keys-shared";
import { cn } from "~/lib/utils";

const CHUNK = 5000;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: TFn;
  fmt: (n: number) => string;
  /** Called with a one-line summary once something was stored; the page refreshes its list. */
  onSaved: (summary: string) => void;
}

interface SaveResponse {
  status: string;
  added: number;
  skipped: number;
  invalid: number;
  error?: string;
}

export function AddKeysDialog({ open, onOpenChange, t, fmt, onSaved }: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [csvInfo, setCsvInfo] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = async (file: File) => {
    if (file.size > CSV_MAX_BYTES) {
      setCsvInfo(t("csvTooBig"));
      return;
    }
    try {
      const { keys, ignored } = parseKeyCsv(await file.text());
      if (!keys.length) {
        setCsvInfo(t("csvEmpty", { file: file.name }));
        return;
      }
      setText((prev) => {
        const have = new Set(
          prev
            .split(/[\s,;]+/)
            .map(normalizeKey)
            .filter((k): k is string => !!k),
        );
        const fresh = keys.filter((k) => !have.has(k));
        const base = prev.trimEnd();
        return fresh.length ? (base ? base + "\n" : "") + fresh.join("\n") : prev;
      });
      setCsvInfo(t("csvParsed", { n: fmt(keys.length), file: file.name, m: fmt(ignored) }));
      setMsg("");
    } catch {
      setCsvInfo(t("csvReadFailed"));
    }
  };

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const save = async () => {
    const payload = [
      ...new Set(
        text
          .split(/[\s,;]+/)
          .map(normalizeKey)
          .filter((k): k is string => !!k),
      ),
    ];
    if (!payload.length) {
      setMsg(t("noReadable"));
      return;
    }
    setSaving(true);
    const totals = { added: 0, skipped: 0, invalid: 0 };
    let done = 0;
    const summary = () => {
      const parts = [totals.added ? t("added", { n: fmt(totals.added) }) : t("noneNew")];
      if (totals.skipped) parts.push(t("dup", { n: fmt(totals.skipped) }));
      if (totals.invalid) parts.push(t("bad", { n: fmt(totals.invalid) }));
      return parts.join(" · ");
    };
    try {
      for (let i = 0; i < payload.length; i += CHUNK) {
        setMsg(
          payload.length > CHUNK
            ? t("savingProgress", { a: fmt(i), b: fmt(payload.length) })
            : t("saving"),
        );
        const r = await fetch("/api/keys", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ keys: payload.slice(i, i + CHUNK) }),
        });
        const res = (await r.json()) as SaveResponse;
        if (r.status === 429 || res.error === "rate") throw new Error("rate");
        if (!r.ok || res.status !== "success") throw new Error("save");
        totals.added += res.added || 0;
        totals.skipped += res.skipped || 0;
        totals.invalid += res.invalid || 0;
        done = Math.min(i + CHUNK, payload.length);
      }
      setText("");
      setCsvInfo("");
      setMsg("");
      onOpenChange(false);
      onSaved(summary());
    } catch (e) {
      const rate = e instanceof Error && e.message === "rate";
      if (done > 0) {
        setMsg(t("savePartial", { n: fmt(done) }) + (rate ? ` ${t("saveRate")}` : ""));
        onSaved(summary());
      } else setMsg(t(rate ? "saveRate" : "saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("close")}
        className="max-h-[92dvh] gap-3 overflow-y-auto rounded-t-[28px] px-6 pt-3 sm:rounded-3xl sm:pt-6"
        onDragOver={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          e.preventDefault();
          void readFile(file);
        }}
      >
        <div
          className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border sm:hidden"
          aria-hidden="true"
        />
        <DialogTitle className="pe-8 text-xl font-extrabold">{t("addKeys")}</DialogTitle>
        <DialogDescription>{t("hint")}</DialogDescription>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload />
            {t("uploadCsv")}
          </Button>
          <Button type="button" variant="outline" onClick={downloadCsvTemplate}>
            <Download />
            {t("csvTemplate")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".csv,.txt,text/csv,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void readFile(file);
            }}
          />
        </div>
        <Textarea
          dir="ltr"
          className={cn(
            "min-h-44 rounded-2xl font-mono text-[13px] leading-7",
            dragging && "border-primary ring-[3px] ring-ring/40",
          )}
          spellCheck={false}
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"NG-GArejMW3\nNG-a0N7K8xn\nNG-wf2kPgqb\n..."}
          aria-label={t("addKeys")}
        />
        <p className="text-xs text-muted-foreground">{t("csvNote")}</p>
        <div className="min-h-4 text-xs font-medium text-muted-foreground" role="status">
          {csvInfo && <p>{csvInfo}</p>}
          {msg && <p>{msg}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <DialogClose asChild>
            <Button variant="outline" className="h-12">
              {t("close")}
            </Button>
          </DialogClose>
          <Button className="h-12" onClick={save} disabled={saving}>
            <Check />
            {t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
