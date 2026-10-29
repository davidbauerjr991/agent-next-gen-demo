// Contact Details in the reference slide-over (P-HOME-1n: a slot move — the part's slot changed, its component
// didn't). The same header, tab row, bodies and footer the docked panel built: the record's tabs, its Customer Info
// drill-in, and the Experience Memory and Artifacts sub-pages with their back arrows. The name comes from the one
// view-model (`contactDetailsFor`) the hover preview reads too.
import { ArtifactsListBody } from "@/components/customer-info";
import {
  LucasThomasMemoryPanelBody,
  MayaChenCallMemoryPanelBody,
  TomLewisCallMemoryPanelBody,
} from "@/components/agent-next-gen-lucas-thomas-panels";
import { MARCUS_WEBB_ID, MAYA_CHEN_CALL_ID, TOM_LEWIS_CALL_ID } from "@/contact-handling/scenario-cases";
import { slideOverEntry } from "@/contact-handling/slide-over-registry";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { t } from "@/i18n";
import { ContactDetailsTabBody, ContactDetailsTabRow } from "./contact-details-tab-bodies";
import type { DetailSlideOverParts } from "./detail-slide-over-parts";

const MarcusMemoryBody = slideOverEntry(MARCUS_WEBB_ID, "memory")!.Body;

/** The record tabs whose footer is the record's save footer. */
const RECORD_VIEWS = new Set(["Customer Info", "Customer Information", "Notes", "Detail"]);

export function useContactDetailsSlideOverParts(): DetailSlideOverParts {
  const {
    activeInteraction, contactDetails, contactDetailsView: view, customerInfoOverlayContent, experienceMemoryFocus,
    marcusMemoryFocus, openDetailPanelContent, panelArtifacts, reopenPanelArtifact, scenarioKeyOf, setCustomerPanelActiveTab,
  } = useWorkspace();
  const name = contactDetails?.name;
  // A sub-page's back arrow: Contact Details' first tab.
  const back = () => setCustomerPanelActiveTab("Customer Information");
  const footer = RECORD_VIEWS.has(view) ? customerInfoOverlayContent.footer : undefined;

  if (view === "Experience Memory") {
    const key = activeInteraction ? scenarioKeyOf(activeInteraction.id) : undefined;
    return {
      headerTitle: name,
      headerSubhead: t("Experience Memory"),
      onBack: back,
      body: (
        <div className="animate-in fade-in-0 duration-200" data-slot="experience-memory">
          {key === MAYA_CHEN_CALL_ID ? (
            <MayaChenCallMemoryPanelBody />
          ) : key === TOM_LEWIS_CALL_ID ? (
            <TomLewisCallMemoryPanelBody />
          ) : key === MARCUS_WEBB_ID ? (
            <MarcusMemoryBody request={{ panel: "memory", focus: marcusMemoryFocus }} />
          ) : (
            <LucasThomasMemoryPanelBody
              focus={experienceMemoryFocus}
              onOpenOrder={(orderId) => openDetailPanelContent({ kind: "lucas-order", orderId, from: "memory" })}
            />
          )}
        </div>
      ),
    };
  }
  if (view === "Artifacts") {
    return {
      headerTitle: t("Artifacts"),
      headerSubhead: name,
      onBack: back,
      body: (
        <div className="animate-in fade-in-0 duration-200">
          <ArtifactsListBody artifacts={panelArtifacts} onOpenArtifact={reopenPanelArtifact} />
        </div>
      ),
    };
  }
  if (view === "Customer Info") {
    return {
      headerTitle: customerInfoOverlayContent.headerTitle,
      headerSubhead: typeof customerInfoOverlayContent.headerSubhead === "string" ? customerInfoOverlayContent.headerSubhead : name,
      onBack: back,
      headerTabs: <div className="animate-in fade-in-0 duration-200">{customerInfoOverlayContent.headerTabs}</div>,
      footer,
      body: <div className="animate-in fade-in-0 duration-200">{customerInfoOverlayContent.body}</div>,
    };
  }
  return {
    headerTitle: t("Contact Details"),
    headerSubhead: name,
    headerTabs: <ContactDetailsTabRow />,
    footer,
    body: (
      <div data-slot="contact-details-slide-over">
        <ContactDetailsTabBody />
      </div>
    ),
  };
}
