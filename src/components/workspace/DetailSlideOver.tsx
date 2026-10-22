import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { InContactInteriorPanel } from "@/components/agent-next-gen-in-contact-panel";
import { useDetailSlideOverParts } from "@/components/workspace/detail-slide-over-parts";

/** The detail slide-over in the docked panel (P-EXTRACT C8, from the page):
 *  the one shared `InContactInteriorPanel` for the AI rows' and Copilot's
 *  panels, portaled into the right panel. Only for the "panel" placement
 *  (slide-over-placement.ts); the reference slot's is `ReferenceSlot`. */
export function DetailSlideOver() {
  const {
    activeInteraction, portalInto, rightPanelEl, rightPanelSlotMounted, selectedDetailPanelContent,
    setSelectedDetailPanelContent, slideOverInPanel,
  } = useWorkspace();
  const { body, ...header } = useDetailSlideOverParts();
  if (!activeInteraction || !slideOverInPanel) return null;
  return portalInto(rightPanelSlotMounted ? rightPanelEl.current : null,
    <InContactInteriorPanel
      key={rightPanelSlotMounted ? "right-panel" : "content-card"}
      // It opens once the panel's slot exists: an action handed off from the Contact
      // Details hover preview opens the panel and the slide-over in one click (k6 6).
      open={!!selectedDetailPanelContent && rightPanelSlotMounted}
      onClose={() => setSelectedDetailPanelContent(null)}
      {...header}
    >
      {body}
    </InContactInteriorPanel>
  );
}
