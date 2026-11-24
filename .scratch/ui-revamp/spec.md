# UI revamp: drop the copycat look

Status: resolved

## Question settled

The current UI is a near-copy of nusukkey.cekin.cloud (parchment + indigo/amber, moon mark, stat box, sticky search bar with toggle switches, card rows with checkbox + Copy/Open/Ban). What should a distinct, mobile-first replacement look like?

## Answer (2026-11-24)

Three variants were prototyped on `/prototype/redesign?variant=A|B|C` against real `/api/keys` data:

- **A · Focus flow** (chosen): one big "next code" hero card, a single "Salin & Buka" primary action, inline "Berhasil dipakai?" check-in (Berhasil / Ditolak → confirm sheet), Lewati (skip), a collapsible "Antrean" peek, a "Lihat semua" full-screen searchable list, bottom tab bar (Kode / Jawaban / Tambah). Answers list is answer-first. Emerald (#0f766e) on near-white, Manrope + JetBrains Mono.
- B · Dark ledger: dense dark list, swipe rows, bottom search dock. Rejected.
- C · Guided home: dashboard, ticket carousel, flashcards. Rejected.

Prototype source: `src/components/prototype/` + `src/routes/prototype.redesign.tsx` (no git repo yet, so not on a throwaway branch; removed from the app after the fold-in, copy kept under `.scratch/ui-revamp/prototype/`).

## Product rules confirmed

- The pinned code is not visibly pinned: it is simply always the first code. No badge, strip, icon or "utama" copy. New codes append below.
- Mobile-first webapp view.

## Fold-in scope

- Rewrite `/` and `/answers` in the Focus-flow style, keeping all existing behaviour: localStorage used set, hide-invalid, cross-user invalid polling, mark-invalid API with undo and rate/pinned errors, "did it work?" after returning from Nusuk (now the inline check-in), resume progress, add keys (paste + CSV), 8-language i18n incl. RTL, reset used marks.
- Replace the "desert dusk" palette, moon brand and Plus Jakarta Sans.

## Comments

- 2026-11-24 — Folded in. `/` and `/answers` rewritten in Focus flow; theme, brand (key mark), favicon.svg and a shared `TabBar` added; prototype route removed from `src/` (copy in `prototype/` here, ignored by oxlint/oxfmt). Checked at 375px: hero, check-in restore, invalid confirm sheet, "Lihat semua" sheet, `?add=1`, Arabic RTL, answers search. Not yet exercised: a real open, invalid POST + undo, reset, add-keys save, dark mode. Still old moon artwork: `public/*.png`, `og.png`.
