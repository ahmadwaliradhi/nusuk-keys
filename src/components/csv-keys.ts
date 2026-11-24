import { normalizeKey } from "~/lib/keys-shared";

export const CSV_MAX_BYTES = 2 * 1024 * 1024;

export const CSV_TEMPLATE_NAME = "nusuk-keys-template.csv";
export const CSV_TEMPLATE =
  "kode\nNG-AbCd1234\nNG-EfGh5678\nhttps://services.nusuk.sa/app/?p=27&id=NG-IjKl9012\n";

const HEADER_CELLS = new Set([
  "kode",
  "code",
  "codes",
  "key",
  "keys",
  "kunci",
  "id",
  "no",
  "nomor",
  "number",
  "#",
]);

/** Split one line on , ; or tab, honouring simple double-quoted cells. */
function splitCells(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === ";" || c === "\t") {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells;
}

/** Returns the unique keys found and how many non-empty, non-header rows held none. */
export function parseKeyCsv(text: string): { keys: string[]; ignored: number } {
  const keys = new Set<string>();
  let ignored = 0;
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    let found = false;
    let header = false;
    for (const raw of splitCells(line)) {
      const cell = raw.trim();
      if (!cell) continue;
      if (HEADER_CELLS.has(cell.toLowerCase())) {
        header = true;
        continue;
      }
      if (/^\d+$/.test(cell)) continue; // row numbers
      const k = normalizeKey(cell);
      if (k) {
        keys.add(k);
        found = true;
      }
    }
    if (!found && !header) ignored++;
  }
  return { keys: [...keys], ignored };
}

export function downloadCsvTemplate() {
  const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = CSV_TEMPLATE_NAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
