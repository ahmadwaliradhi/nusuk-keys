import { Link } from "@tanstack/react-router";
import { BookOpen, KeyRound, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

interface TabBarProps {
  active: "keys" | "answers";
  labels: { keys: string; answers: string; add: string };
  /** On the keys page "Tambah" opens the add sheet in place; elsewhere it links to `/?add=1`. */
  onAdd?: () => void;
  /** Dot on the answers tab until the user has visited it once. */
  answersNew?: boolean;
  onAnswersClick?: () => void;
}

const item =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors";

function Pill({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "relative grid h-8 w-14 place-items-center rounded-full transition-colors",
        on && "bg-accent text-primary",
      )}
    >
      {children}
    </span>
  );
}

/** Fixed bottom navigation shared by the keys and answers pages. */
export function TabBar({ active, labels, onAdd, answersNew, onAnswersClick }: TabBarProps) {
  const tone = (on: boolean) => (on ? "text-primary" : "text-muted-foreground");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[560px]">
        <Link
          to="/"
          className={cn(item, tone(active === "keys"))}
          aria-current={active === "keys" ? "page" : undefined}
        >
          <Pill on={active === "keys"}>
            <KeyRound className="size-5" aria-hidden="true" />
          </Pill>
          {labels.keys}
        </Link>
        <Link
          to="/answers"
          onClick={onAnswersClick}
          className={cn(item, tone(active === "answers"))}
          aria-current={active === "answers" ? "page" : undefined}
        >
          <Pill on={active === "answers"}>
            <BookOpen className="size-5" aria-hidden="true" />
            {answersNew && (
              <span className="absolute top-0.5 right-2.5 size-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </Pill>
          {labels.answers}
        </Link>
        {onAdd ? (
          <button type="button" onClick={onAdd} className={cn(item, tone(false))}>
            <Pill on={false}>
              <Plus className="size-5" aria-hidden="true" />
            </Pill>
            {labels.add}
          </button>
        ) : (
          <a href="/?add=1" className={cn(item, tone(false))}>
            <Pill on={false}>
              <Plus className="size-5" aria-hidden="true" />
            </Pill>
            {labels.add}
          </a>
        )}
      </div>
    </nav>
  );
}
