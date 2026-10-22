// The built-in canvas cells (P-CANVAS): each wraps the card's one
// implementation and reads the workspace controller, so the registry
// (`src/contact-handling/canvas-registry.ts`) can mount it in either region.
import { VoiceWrapUpCard } from "@/contact-handling/VoiceWrapUpCard";
import { HostSlot } from "@/contact-handling/portal-hosts";
import { MARCUS_WEBB_ID } from "@/contact-handling/scenario-cases";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import type { CanvasCell } from "@/contact-handling/canvas-registry";
import {
  ArtifactsSection,
  CustomerInfoSection,
  JourneySummarySection,
  LinkCustomerButton,
  hasCustomerInfo,
} from "@/components/customer-info/reference-sections";

function CustomerInfoCell() {
  const { referenceCardProps } = useWorkspace();
  if (!referenceCardProps) return null;
  return (
    <>
      <LinkCustomerButton onLinkCustomer={referenceCardProps.onLinkCustomer} />
      <CustomerInfoSection {...referenceCardProps} />
    </>
  );
}

function JourneySummaryCell() {
  const { referenceCardProps } = useWorkspace();
  return referenceCardProps ? <JourneySummarySection {...referenceCardProps} /> : null;
}

function ArtifactsCell() {
  const { referenceCardProps } = useWorkspace();
  return referenceCardProps ? <ArtifactsSection {...referenceCardProps} /> : null;
}

function AutosummaryCell() {
  return <>{useWorkspace().renderAutosummary()}</>;
}

function MarcusCardCell() {
  return <HostSlot host={useWorkspace().marcusCardHost} />;
}

function VoiceWrapUpCell() {
  const { activeInteraction, activeWrapUpThread, outcomeConfigFor } = useWorkspace();
  if (!activeInteraction || !activeWrapUpThread) return null;
  return <VoiceWrapUpCard outcome={outcomeConfigFor(activeInteraction, activeWrapUpThread, "inline")} />;
}

export const DEFAULT_CANVAS_CELLS: readonly CanvasCell[] = [
  // Reference: what the agent consults.
  {
    id: "customer-info",
    region: "reference",
    order: 10,
    component: CustomerInfoCell,
    // A customer record, or an unmatched customer's "Link to existing customer".
    applies: ({ referenceCardProps: p }) => !!p && (hasCustomerInfo(p) || !!p.onLinkCustomer),
  },
  {
    id: "journey-summary",
    region: "reference",
    order: 20,
    component: JourneySummaryCell,
    applies: ({ referenceCardProps: p }) => !!p?.customerContextOverview,
  },
  {
    id: "artifacts",
    region: "reference",
    order: 30,
    component: ArtifactsCell,
    applies: ({ referenceCardProps: p }) => (p?.artifacts?.length ?? 0) > 0,
  },
  // Action: what the agent must do now.
  { id: "autosummary", region: "action", order: 10, component: AutosummaryCell, applies: (ws) => !!ws.renderAutosummary() },
  {
    id: "marcus-card",
    region: "action",
    order: 20,
    component: MarcusCardCell,
    applies: (ws) => !!ws.activeInteraction && ws.scenarioKeyOf(ws.activeInteraction.id) === MARCUS_WEBB_ID,
  },
  { id: "conversation", region: "action", order: 30 },
  { id: "voice-wrap-up", region: "action", order: 40, component: VoiceWrapUpCell, applies: (ws) => !!ws.activeWrapUpThread },
];
