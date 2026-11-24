import { KeyRound } from "lucide-react";

/** Small wordmark: emerald key tile + name. */
export function Brand() {
  return (
    <span className="flex items-center gap-2 text-[13px] font-extrabold tracking-wide whitespace-nowrap text-primary uppercase">
      <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
        <KeyRound className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      </span>
      Nusuk Keys
    </span>
  );
}
