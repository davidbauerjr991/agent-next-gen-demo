import type { ReactNode } from "react";
import { formAt, isHosted, type SlotRegion } from "./part-components";
import type { PartId } from "./parts";
import type { SlotId } from "./slots";
import { useSlotParts } from "./useSlot";

/** A slot's parts at one place in its container, in `layout.parts` order (P-LAYOUT): each part's component form
 *  (`part-components.tsx`), or — for a part the container hosts itself — whatever `children(part)` returns for it
 *  (`null` when it's mounted elsewhere). Renders no element of its own, so the container's own spacing applies, and
 *  forwards LeftNav's injected `expanded` to the parts. */
export function Slot({
  id,
  region,
  expanded,
  children,
}: {
  id: SlotId;
  region?: SlotRegion;
  expanded?: boolean;
  /** A hosted part's node, given the slot's whole list (a part whose form depends on its neighbours). */
  children?: (part: PartId, parts: readonly PartId[]) => ReactNode;
}) {
  const parts = useSlotParts(id);
  return (
    <>
      {parts.map((part) => {
        const form = formAt(part, id, region);
        if (!form) return null;
        if (isHosted(form)) return children ? <SlotItem key={part}>{children(part, parts)}</SlotItem> : null;
        const Form = form;
        return <Form key={part} slot={id} expanded={expanded} />;
      })}
    </>
  );
}

/** Keys a hosted part's node in the slot's list. */
function SlotItem({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Whether any part has a component form at a place (a container that renders a wrapper only when it's filled,
 *  e.g. LeftNav's sticky caption). */
export function useSlotFilled(id: SlotId, region?: SlotRegion): boolean {
  return useSlotParts(id).some((part) => {
    const form = formAt(part, id, region);
    return !!form && !isHosted(form);
  });
}
