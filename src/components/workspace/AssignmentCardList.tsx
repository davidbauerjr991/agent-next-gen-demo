// One assignment card's drag target (P-PROFILES 0b): the wrapper lyra's
// `useListReorder` moves, for the left nav and the interior panel alike. The
// order and drag wiring are `useAssignmentCards` (src/contact-handling/).
import * as React from "react";
import type { ListReorderItemProps } from "@nicecxone/lyra-ui";

export function DraggableAssignment({ props, children }: { props: ListReorderItemProps; children: React.ReactNode }) {
  return (
    <div
      {...props}
      data-slot="assignment-card"
      className="rounded-lyra-sm data-[drag-over]:bg-lyra-bg-active-moderate data-[dragging]:opacity-50"
    >
      {children}
    </div>
  );
}
