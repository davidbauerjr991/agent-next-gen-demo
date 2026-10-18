import { createPortal } from "react-dom";
import { MarcusWebbNextBestActionCard, MARCUS_WEBB_ORDER } from "@/components/agent-next-gen-marcus-webb-next-best-action-card";
import { MARCUS_WEBB_ID } from "@/contact-handling/scenario-cases";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { MARCUS_WEBB_AUTO_DISMISS_ON_CLOSE } from "./workspace-constants";

/** Marcus's Next Best Action card (P-EXTRACT C8, from the page): it lives in a
 *  persistent host node (moved into the transcript by a HostSlot), so
 *  navigating away and back never resets its state or its running timers.
 *  Unmounted when the assignment is dismissed. */
export function MarcusCardMount() {
  const {
    activeInteraction, focusCustomerPanelTab, handleDismissInteraction, handleMarcusWebbEscalated,
    handleMarcusWebbResolved, marcusCardHost, marcusCopilotRequests, marcusQuestionHost, marcusWebbReviewing,
    marcusWebbSays, openDetailPanelContent, openExperienceMemoryInSidePanel, scenarioCardId, scenarioKeyOf,
    selectedDetailPanelContent, setMarcusMemoryFocus, setMarcusWebbPhotoExpanded,
  } = useWorkspace();
  if (!scenarioCardId(MARCUS_WEBB_ID)) return null;
  return createPortal(
                                      <MarcusWebbNextBestActionCard
            // Each line below is one of Marcus's script's action branches
            // (src/scenarios/scripts/marcus-webb.ts), played by the engine.
            // `onComplete` only ever passes the card's rejection reply.
            onComplete={() => marcusWebbSays("rejected")}
            onAgentContactedCustomer={() => marcusWebbSays("approved")}
            onCustomerApprovedResolution={() => marcusWebbSays("customer-thanks")}
            onDispositionUpdated={handleMarcusWebbResolved}
            onAssignmentClosed={() => {
              // See `MARCUS_WEBB_AUTO_DISMISS_ON_CLOSE`'s own doc
              // comment — held off for now while testing.
              if (!MARCUS_WEBB_AUTO_DISMISS_ON_CLOSE) return;
              const cardId = scenarioCardId(MARCUS_WEBB_ID);
              if (cardId) handleDismissInteraction(cardId);
            }}
            onPhotoRequested={() => marcusWebbSays("photo-requested")}
            // Per explicit request ("add customer responses to the
            // transcript indicating they are annoyed they have to provide
            // visual proof and that the refund was denied").
            onCustomerReactedToRejection={() => marcusWebbSays("rejection-reaction")}
            onCustomerReactedToPhotoRequest={() => marcusWebbSays("photo-reaction")}
            onPhotoExpand={() => setMarcusWebbPhotoExpanded(true)}
            onStatusEscalated={handleMarcusWebbEscalated}
            takenOver={!marcusWebbReviewing}
            onTakeoverGreeting={() => marcusWebbSays("takeover-greeting")}
            onCustomerRespondedToTakeover={() => marcusWebbSays("takeover-reply")}
            onRemedyIssued={(remedy, detail) => {
              if (remedy === "store-credit") marcusWebbSays("remedy-store-credit", { vars: { storeCreditAmount: detail.storeCreditAmount ?? "" } });
              else if (remedy === "discount-code") marcusWebbSays("remedy-discount-code", { vars: { discountPercent: detail.discountPercent ?? "" } });
              else marcusWebbSays("remedy-other", { note: detail.note?.trim() ?? "" });
              // The reject-then-remedy path's own
              // "issue answered" moment — mirrors
              // `onDispositionUpdated`'s identical
              // call on the Approve path
              // (`handleMarcusWebbResolved`,
              // below in this same file), so both
              // ways of resolving Marcus's
              // exception converge on the one
              // shared "Resolved" signal that now
              // also reveals the Unassign &
              // Dismiss icon (see `showDismiss
              // Button` above and `onDismiss
              // Channel` below).
              handleMarcusWebbResolved();
            }}
            onActionLogEntryOpen={(entry) =>
              openDetailPanelContent({ kind: "action-log", entry })
            }
            selectedActionLogEntryId={
              scenarioKeyOf(activeInteraction?.id) === MARCUS_WEBB_ID && selectedDetailPanelContent?.kind === "action-log"
                ? selectedDetailPanelContent.entry.id
                : null
            }
            onViewArticle={(article) =>
              openDetailPanelContent({ kind: "article", article })
            }
            selectedArticleId={
              scenarioKeyOf(activeInteraction?.id) === MARCUS_WEBB_ID && selectedDetailPanelContent?.kind === "article"
                ? selectedDetailPanelContent.article.id
                : null
            }
            // Per explicit follow-up request
            // ("this should behave the same as
            // if I clicked between contact
            // history items on the home page"),
            // order/transactions go through the
            // SAME `openDetailPanelContent` (its
            // own toggle-off-if-same/swap-if-
            // different semantics, above).
            // Marcus Webb's clickable name
            // ("customer") no longer does, per a
            // LATER explicit request ("move the
            // customer information content back
            // to the side panel") — it now opens
            // the DOCKED `CustomerInformationSide
            // Panel`'s own "Customer Info"
            // drill-in instead
            // (`focusCustomerPanelTab`), the same
            // target the Contact Overview's own
            // "View customer info" link opens, so
            // the two can never disagree about
            // where "customer info" actually
            // lives.
            onOpenCustomerInfo={focusCustomerPanelTab}
            onOpenOrderInfo={() =>
              openDetailPanelContent({ kind: "order", order: MARCUS_WEBB_ORDER })
            }
            copilotRequests={marcusCopilotRequests}
            onOpenCopilotRequest={(r) => openDetailPanelContent({ kind: "marcus-copilot", ...r })}
            activeCopilotRequestId={
              scenarioKeyOf(activeInteraction?.id) === MARCUS_WEBB_ID && selectedDetailPanelContent?.kind === "marcus-copilot"
                ? selectedDetailPanelContent.id
                : null
            }
            onOpenExperienceMemory={(focus) => {
              setMarcusMemoryFocus(focus);
              openExperienceMemoryInSidePanel();
            }}
            onOpenTransactions={(round) =>
              openDetailPanelContent({ kind: "transactions", ...round })
            }
            selectedTransactionsId={
              scenarioKeyOf(activeInteraction?.id) === MARCUS_WEBB_ID && selectedDetailPanelContent?.kind === "transactions"
                ? selectedDetailPanelContent.id
                : null
            }
            onDismissAndUnassign={() => {
              const cardId = scenarioCardId(MARCUS_WEBB_ID);
              if (cardId) handleDismissInteraction(cardId);
            }}
            questionSlotElement={marcusQuestionHost}
          />,
          marcusCardHost
  );
}
