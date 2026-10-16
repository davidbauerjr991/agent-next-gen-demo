import type { ReactNode } from "react";
import { Tooltip } from "@nicecxone/lyra-ui";

/** Says why a control is disabled: a lyra `Tooltip` on a wrapping span,
 *  since a disabled `Button` takes no pointer events (its own `title` never
 *  shows). No reason: the child alone. The same wrapper lyra's `CreateNew`
 *  uses for its `disabledReason`. */
export function DisabledReason({ reason, children }: { reason: string | undefined; children: ReactNode }) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip content={reason} placement="top">
      <span className="inline-flex" data-disabled-reason={reason}>
        {children}
      </span>
    </Tooltip>
  );
}
