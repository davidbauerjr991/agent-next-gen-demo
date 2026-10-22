import type { ReactNode } from "react";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { CopilotResultPanelBody } from "@/components/copilot-result-panel";
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

/** The interior slide-over's header and body for the last selected content
 *  (`lastDetailPanelContent`, so it keeps showing through the close), shared
 *  by both mounts: the docked panel's (`DetailSlideOver`) and the reference
 *  slot's (`ReferenceSlot`). */
export interface DetailSlideOverParts {
  headerTitle?: string;
  headerSubhead?: string;
  onBack?: () => void;
  footer?: ReactNode;
  body: ReactNode;
}

export function useDetailSlideOverParts(): DetailSlideOverParts {
  const { channelPreviewMeta, lastDetailPanelContent: content, sessionDetailsTabContent, setSelectedDetailPanelContent } =
    useWorkspace();
  const headerTitle =
    content?.kind === "session"
      ? "Session Details"
      : content?.kind === "action-log"
      ? content.entry.title
      : content?.kind === "article"
        ? content.article.title
        : content?.kind === "article-link"
          ? content.link.title
          : content?.kind === "order"
            ? content.order.itemName
            : content?.kind === "lucas"
            ? LUCAS_THOMAS_PANEL_TITLES[content.panel].title
            : content?.kind === "tom-call"
            ? TOM_LEWIS_CALL_PANEL_TITLES[content.panel].title
            : content?.kind === "lucas-memory"
            ? "Lucas Thomas"
            : content?.kind === "lucas-instruction" || content?.kind === "marcus-copilot" || content?.kind === "copilot-result"
            ? content.text
            : content?.kind === "lucas-order"
            ? LUCAS_THOMAS_ORDER_DETAILS[content.orderId].item
            : content?.kind === "transactions"
              ? content.note
              : undefined;
  const headerSubhead =
    content?.kind === "session"
      ? channelPreviewMeta?.label
      : content?.kind === "action-log"
      ? content.entry.timestamp
      : content?.kind === "transactions"
        ? content.timestamp
        : content?.kind === "lucas"
        ? LUCAS_THOMAS_PANEL_TITLES[content.panel].subhead
        : content?.kind === "tom-call"
        ? TOM_LEWIS_CALL_PANEL_TITLES[content.panel].subhead
        : content?.kind === "lucas-memory"
        ? "Experience Memory"
        : content?.kind === "lucas-instruction" || content?.kind === "marcus-copilot" || content?.kind === "copilot-result"
        ? `${content.time} · John Smith`
        : content?.kind === "lucas-order"
        ? `${LUCAS_THOMAS_ORDER_DETAILS[content.orderId].orderId} · ${LUCAS_THOMAS_ORDER_DETAILS[content.orderId].ordered}`
        : undefined;
  const onBack =
    // Orders opened from the purchase-history panel go back to it; orders opened from the docked
    // Experience Memory view have nothing to go back to inside the slide-out, so no arrow.
    content?.kind === "lucas-order" && content.from === "purchases"
      ? () => setSelectedDetailPanelContent({ kind: "lucas", panel: "purchase-history" })
      : content?.kind === "lucas-order"
      ? undefined
      : content?.kind === "article-link"
      ? () => setSelectedDetailPanelContent({ kind: "article", article: content.article })
      : undefined;
  const footer = content?.kind === "session" ? sessionDetailsTabContent.footer : undefined;
  const body = (
    <>
      {content?.kind === "session" && <div data-slot="session-slide-over">{sessionDetailsTabContent.body}</div>}
      {content?.kind === "action-log" && <MarcusWebbActionDetailPanelBody entry={content.entry} />}
      {content?.kind === "article" && (
        <KnowledgeArticleDetailPanelBody
          data={content.article}
          onViewLink={(link) => setSelectedDetailPanelContent({ kind: "article-link", article: content.article, link })}
        />
      )}
      {content?.kind === "article-link" && <KnowledgeArticleLinkDetailBody link={content.link} />}
      {content?.kind === "lucas-memory" && (
        <LucasThomasMemoryPanelBody
          focus={content.focus}
          onOpenOrder={(orderId) => setSelectedDetailPanelContent({ kind: "lucas-order", orderId })}
        />
      )}
      {content?.kind === "tom-call" && <TomLewisCallPanelBody panel={content.panel} />}
      {content?.kind === "marcus-copilot" && <MarcusWebbCopilotPanelBody text={content.text} time={content.time} />}
      {content?.kind === "lucas-instruction" && (
        <LucasThomasInstructionPanelBody decision={content.decision} text={content.text} time={content.time} />
      )}
      {content?.kind === "copilot-result" && <CopilotResultPanelBody text={content.text} time={content.time} />}
      {content?.kind === "lucas-order" && <LucasThomasOrderPanelBody orderId={content.orderId} />}
      {content?.kind === "lucas" && content.panel === "product" && <LucasThomasProductPanelBody />}
      {content?.kind === "lucas" && content.panel === "payments" && <LucasThomasPaymentsPanelBody />}
      {content?.kind === "lucas" && content.panel === "fraud-screening" && <LucasThomasFraudPanelBody />}
      {content?.kind === "lucas" && content.panel === "payment-preferences" && <LucasThomasPreferencesPanelBody />}
      {content?.kind === "lucas" && content.panel === "shipping-check" && <LucasThomasShippingPanelBody />}
      {content?.kind === "lucas" && content.panel === "ai-attempts" && <LucasThomasAiAttemptsPanelBody />}
      {content?.kind === "lucas" && content.panel === "purchase-history" && (
        <LucasThomasPurchaseHistoryPanelBody
          onOpenOrder={(orderId) => setSelectedDetailPanelContent({ kind: "lucas-order", orderId, from: "purchases" })}
        />
      )}
      {content?.kind === "lucas" && content.panel === "article-pay-3-2" && <LucasThomasArticlePanelBody />}
      {content?.kind === "lucas" && content.panel === "payment-link" && <LucasThomasPaymentLinkPanelBody />}
      {content?.kind === "order" && <MarcusWebbOrderDetailPanelBody order={content.order} />}
      {content?.kind === "transactions" && (
        <MarcusWebbTransactionsDetailPanelBody
          note={content.note}
          timestamp={content.timestamp}
          date={content.date}
          showFullTransactions={content.showFullTransactions}
        />
      )}
    </>
  );
  return { headerTitle, headerSubhead, onBack, footer, body };
}
