import { Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "~/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-[1.35rem] data-[state=unchecked]:translate-x-0.5 rtl:data-[state=checked]:-translate-x-[1.35rem] rtl:data-[state=unchecked]:-translate-x-0.5" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
