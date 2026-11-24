import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  closeLabel: string;
  /** Optional code shown in a mono block between description and buttons. */
  code?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/** Bottom sheet on mobile, centered dialog from `sm`. Cancel is first in focus order. */
export function ConfirmDialog(p: ConfirmDialogProps) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        closeLabel={p.closeLabel}
        className="gap-3 rounded-t-[28px] px-6 pt-3 sm:rounded-3xl sm:pt-6"
      >
        <div
          className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border sm:hidden"
          aria-hidden="true"
        />
        <DialogTitle className="pe-8 text-xl font-extrabold">{p.title}</DialogTitle>
        <DialogDescription>{p.description}</DialogDescription>
        {p.code && (
          <p
            dir="ltr"
            className="rounded-2xl bg-muted py-3 text-center font-mono text-lg font-bold break-all [unicode-bidi:isolate]"
          >
            {p.code}
          </p>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          <DialogClose asChild>
            <Button variant="outline" className="h-12">
              {p.cancelLabel}
            </Button>
          </DialogClose>
          <Button
            variant={p.destructive ? "destructive" : "default"}
            className="h-12"
            onClick={() => {
              p.onOpenChange(false);
              p.onConfirm();
            }}
          >
            {p.confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
