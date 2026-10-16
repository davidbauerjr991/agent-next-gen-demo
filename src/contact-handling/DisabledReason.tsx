import type { ReactNode } from "react";
import { Tooltip } from "@nicecxone/lyra-ui";
import { cn } from "@/lib/utils";

/** Says why a control is disabled: a lyra `Tooltip` on a wrapping span,
 *  since a disabled `Button` takes no pointer events (its own `title` never
 *  shows). No reason: the child alone. The same wrapper lyra's `CreateNew`
 *  uses for its `disabledReason`. `className` sizes the span (e.g. "flex
 *  w-full" around a full-width button); inside a popover the tooltip sits
 *  above the nested-popover tiers. */
export function DisabledReason({ reason, className, children }: { reason: string | undefined; className?: string; children: ReactNode }) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip content={reason} placement="top" className="z-[10006]">
      <span className={cn("inline-flex", className)} data-disabled-reason={reason}>
        {children}
      </span>
    </Tooltip>
  );
}
