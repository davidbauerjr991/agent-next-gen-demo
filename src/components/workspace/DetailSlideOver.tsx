import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { CopilotResultPanelBody } from "@/components/copilot-result-panel";
import { InContactInteriorPanel } from "@/components/agent-next-gen-in-contact-panel";
import { KnowledgeArticleDetailPanelBody, KnowledgeArticleLinkDetailBody } from "@/components/agent-next-gen-knowledge-article-card";
import {
  LUCAS_THOMAS_ORDER_DETAILS,
  LUCAS_THOMAS_PANEL_TITLES,
  LucasThomasAiAttemptsPanelBody,
  LucasThomasArticlePanelBody,
  LucasThomasFraudPanelBody,
  LucasThomasInstructionPanelBody,
  LucasThomasMemoryPanelBody,
  LucasThomasOrderPanelBody,
  LucasThomasPaymentLinkPanelBody,
  LucasThomasPaymentsPanelBody,
  LucasThomasPreferencesPanelBody,
  LucasThomasProductPanelBody,
  LucasThomasPurchaseHistoryPanelBody,
  LucasThomasShippingPanelBody,
  MarcusWebbCopilotPanelBody,
  TOM_LEWIS_CALL_PANEL_TITLES,
  TomLewisCallPanelBody,
} from "@/components/agent-next-gen-lucas-thomas-panels";
import {
  MarcusWebbActionDetailPanelBody,
  MarcusWebbOrderDetailPanelBody,
  MarcusWebbTransactionsDetailPanelBody,
} from "@/components/agent-next-gen-marcus-webb-next-best-action-card";

/** The detail slide-over (P-EXTRACT C8, from the page): the one shared
 *  `InContactInteriorPanel` for the AI rows' and Copilot's panels, over the
 *  content card or portaled into the right panel (`slideOverInPanel`). */
export function DetailSlideOver() {
  const {
    activeInteraction, channelPreviewMeta, lastDetailPanelContent, portalInto, rightPanelEl, rightPanelSlotMounted,
    selectedDetailPanelContent, sessionDetailsTabContent, setSelectedDetailPanelContent, slideOverInPanel,
  } = useWorkspace();
  return (
    <>
            {activeInteraction && portalInto(slideOverInPanel && rightPanelSlotMounted ? rightPanelEl.current : null,
              <InContactInteriorPanel
                key={slideOverInPanel && rightPanelSlotMounted ? "right-panel" : "content-card"}
                // In the panel, it opens once the panel's slot exists: an action handed off from the Contact
                // Details hover preview opens the panel and the slide-over in one click (k6 6).
                open={!!selectedDetailPanelContent && (!slideOverInPanel || rightPanelSlotMounted)}
                onClose={() => setSelectedDetailPanelContent(null)}
                footer={lastDetailPanelContent?.kind === "session" ? sessionDetailsTabContent.footer : undefined}
                headerTitle={
                  lastDetailPanelContent?.kind === "session"
                    ? "Session Details"
                    : lastDetailPanelContent?.kind === "action-log"
                    ? lastDetailPanelContent.entry.title
                    : lastDetailPanelContent?.kind === "article"
                      ? lastDetailPanelContent.article.title
                      : lastDetailPanelContent?.kind === "article-link"
                        ? lastDetailPanelContent.link.title
                        : lastDetailPanelContent?.kind === "order"
                          ? lastDetailPanelContent.order.itemName
                          : lastDetailPanelContent?.kind === "lucas"
                          ? LUCAS_THOMAS_PANEL_TITLES[lastDetailPanelContent.panel].title
                          : lastDetailPanelContent?.kind === "tom-call"
                          ? TOM_LEWIS_CALL_PANEL_TITLES[lastDetailPanelContent.panel].title
                          : lastDetailPanelContent?.kind === "lucas-memory"
                          ? "Lucas Thomas"
                          : lastDetailPanelContent?.kind === "lucas-instruction" || lastDetailPanelContent?.kind === "marcus-copilot" || lastDetailPanelContent?.kind === "copilot-result"
                          ? lastDetailPanelContent.text
                          : lastDetailPanelContent?.kind === "lucas-order"
                          ? LUCAS_THOMAS_ORDER_DETAILS[lastDetailPanelContent.orderId].item
                          : lastDetailPanelContent?.kind === "transactions"
                            ? lastDetailPanelContent.note
                            : undefined
                }
                headerSubhead={
                  lastDetailPanelContent?.kind === "session"
                    ? channelPreviewMeta?.label
                    : lastDetailPanelContent?.kind === "action-log"
                    ? lastDetailPanelContent.entry.timestamp
                    : lastDetailPanelContent?.kind === "transactions"
                      ? lastDetailPanelContent.timestamp
                      : lastDetailPanelContent?.kind === "lucas"
                      ? LUCAS_THOMAS_PANEL_TITLES[lastDetailPanelContent.panel].subhead
                      : lastDetailPanelContent?.kind === "tom-call"
                      ? TOM_LEWIS_CALL_PANEL_TITLES[lastDetailPanelContent.panel].subhead
                      : lastDetailPanelContent?.kind === "lucas-memory"
                      ? "Experience Memory"
                      : lastDetailPanelContent?.kind === "lucas-instruction" || lastDetailPanelContent?.kind === "marcus-copilot" || lastDetailPanelContent?.kind === "copilot-result"
                      ? `${lastDetailPanelContent.time} · John Smith`
                      : lastDetailPanelContent?.kind === "lucas-order"
                      ? `${LUCAS_THOMAS_ORDER_DETAILS[lastDetailPanelContent.orderId].orderId} · ${LUCAS_THOMAS_ORDER_DETAILS[lastDetailPanelContent.orderId].ordered}`
                      : undefined
                }
                onBack={
                  // Orders opened from the purchase-history panel go back to it; orders opened from the docked
                  // Experience Memory view have nothing to go back to inside the slide-out, so no arrow.
                  lastDetailPanelContent?.kind === "lucas-order" && lastDetailPanelContent.from === "purchases"
                    ? () => setSelectedDetailPanelContent({ kind: "lucas", panel: "purchase-history" })
                    : lastDetailPanelContent?.kind === "lucas-order"
                    ? undefined
                    : lastDetailPanelContent?.kind === "article-link"
                    ? () =>
                        setSelectedDetailPanelContent({ kind: "article", article: lastDetailPanelContent.article })
                    : undefined
                }
              >
                {lastDetailPanelContent?.kind === "session" && <div data-slot="session-slide-over">{sessionDetailsTabContent.body}</div>}
                {lastDetailPanelContent?.kind === "action-log" && (
                  <MarcusWebbActionDetailPanelBody entry={lastDetailPanelContent.entry} />
                )}
                {lastDetailPanelContent?.kind === "article" && (
                  <KnowledgeArticleDetailPanelBody
                    data={lastDetailPanelContent.article}
                    onViewLink={(link) =>
                      setSelectedDetailPanelContent({
                        kind: "article-link",
                        article: lastDetailPanelContent.article,
                        link,
                      })
                    }
                  />
                )}
                {lastDetailPanelContent?.kind === "article-link" && (
                  <KnowledgeArticleLinkDetailBody link={lastDetailPanelContent.link} />
                )}
                {lastDetailPanelContent?.kind === "lucas-memory" && (
                  <LucasThomasMemoryPanelBody
                    focus={lastDetailPanelContent.focus}
                    onOpenOrder={(orderId) => setSelectedDetailPanelContent({ kind: "lucas-order", orderId })}
                  />
                )}
                {lastDetailPanelContent?.kind === "tom-call" && <TomLewisCallPanelBody panel={lastDetailPanelContent.panel} />}
                {lastDetailPanelContent?.kind === "marcus-copilot" && (
                  <MarcusWebbCopilotPanelBody text={lastDetailPanelContent.text} time={lastDetailPanelContent.time} />
                )}
                {lastDetailPanelContent?.kind === "lucas-instruction" && (
                  <LucasThomasInstructionPanelBody
                    decision={lastDetailPanelContent.decision}
                    text={lastDetailPanelContent.text}
                    time={lastDetailPanelContent.time}
                  />
                )}
                {lastDetailPanelContent?.kind === "copilot-result" && (
                  <CopilotResultPanelBody text={lastDetailPanelContent.text} time={lastDetailPanelContent.time} />
                )}
                {lastDetailPanelContent?.kind === "lucas-order" && (
                  <LucasThomasOrderPanelBody orderId={lastDetailPanelContent.orderId} />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "product" && (
                  <LucasThomasProductPanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "payments" && (
                  <LucasThomasPaymentsPanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "fraud-screening" && (
                  <LucasThomasFraudPanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "payment-preferences" && (
                  <LucasThomasPreferencesPanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "shipping-check" && (
                  <LucasThomasShippingPanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "ai-attempts" && (
                  <LucasThomasAiAttemptsPanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "purchase-history" && (
                  <LucasThomasPurchaseHistoryPanelBody
                    onOpenOrder={(orderId) =>
                      setSelectedDetailPanelContent({ kind: "lucas-order", orderId, from: "purchases" })
                    }
                  />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "article-pay-3-2" && (
                  <LucasThomasArticlePanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "payment-link" && (
                  <LucasThomasPaymentLinkPanelBody />
                )}
                {lastDetailPanelContent?.kind === "order" && (
                  <MarcusWebbOrderDetailPanelBody order={lastDetailPanelContent.order} />
                )}
                {lastDetailPanelContent?.kind === "transactions" && (
                  <MarcusWebbTransactionsDetailPanelBody
                    note={lastDetailPanelContent.note}
                    timestamp={lastDetailPanelContent.timestamp}
                    date={lastDetailPanelContent.date}
                    showFullTransactions={lastDetailPanelContent.showFullTransactions}
                  />
                )}
              </InContactInteriorPanel>
            )}
    </>
  );
}
