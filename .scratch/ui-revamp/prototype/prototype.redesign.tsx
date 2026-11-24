// PROTOTYPE — throwaway. Three radically different mobile-first redesigns of the keys + answers app,
// switchable via ?variant=A|B|C on /prototype/redesign. Real keys from /api/keys, mutations stubbed.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PrototypeSwitcher } from "~/components/prototype/switcher";
import { useProtoData } from "~/components/prototype/use-proto-data";
import { VariantA, VARIANT_A_NAME } from "~/components/prototype/variant-a";
import { VariantB, VARIANT_B_NAME } from "~/components/prototype/variant-b";
import { VariantC, VARIANT_C_NAME } from "~/components/prototype/variant-c";

export const Route = createFileRoute("/prototype/redesign")({
  validateSearch: (s: Record<string, unknown>) => ({
    variant: typeof s.variant === "string" ? s.variant : "A",
  }),
  component: RedesignPrototype,
});

const VARIANTS = [
  { key: "A", name: VARIANT_A_NAME },
  { key: "B", name: VARIANT_B_NAME },
  { key: "C", name: VARIANT_C_NAME },
];

function RedesignPrototype() {
  const { variant } = Route.useSearch();
  const navigate = useNavigate({ from: "/prototype/redesign" });
  const data = useProtoData();
  return (
    // Desktop: centered phone-width column so it reads as a mobile webapp. Phone: full bleed.
    <div className="min-h-dvh bg-neutral-300 sm:py-6">
      {/* Phone: plain document scroll, fixed = viewport. Desktop: transformed 860px frame so
          fixed bars pin to the frame, with an inner scroller for content. */}
      <div
        key={variant}
        className="relative mx-auto w-full max-w-[430px] overflow-x-clip sm:h-[860px] sm:overflow-hidden sm:rounded-[2.25rem] sm:shadow-2xl sm:[transform:translateZ(0)]"
      >
        <div className="sm:h-full sm:overflow-y-auto">
          {variant === "A" && <VariantA data={data} />}
          {variant === "B" && <VariantB data={data} />}
          {variant === "C" && <VariantC data={data} />}
        </div>
      </div>
      <PrototypeSwitcher
        variants={VARIANTS}
        current={variant}
        onChange={(v) => void navigate({ search: { variant: v }, replace: true })}
      />
    </div>
  );
}
