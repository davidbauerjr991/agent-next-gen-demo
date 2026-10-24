import type { ReactNode } from "react";

/** A labelled value in a slide-over body (shared by the scripted cases' panel files). A leaf module, so the
 *  panel files don't import the slide-over parts (and through them the registry) back. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="lyra-body-sm-emphasis text-lyra-fg-default">{label}</p>
      <div className="lyra-body-md text-lyra-fg-default">{children}</div>
    </div>
  );
}
