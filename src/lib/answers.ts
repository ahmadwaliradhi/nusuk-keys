import data from "./answers.json";

export interface Answer {
  id: string;
  q: string;
  a: string;
}
const ALL = data as Answer[];

import { norm } from "./answers-shared";

const INDEX = ALL.map((x) => ({ x, h: norm(`${x.q} ${x.a}`) }));

export function listAnswers(offset: number, limit: number, q: string) {
  const tokens = norm(q).split(" ").filter(Boolean);
  const hits = tokens.length
    ? INDEX.filter((e) => tokens.every((t) => e.h.includes(t))).map((e) => e.x)
    : ALL;
  return { items: hits.slice(offset, offset + limit), total: ALL.length, filtered: hits.length };
}
