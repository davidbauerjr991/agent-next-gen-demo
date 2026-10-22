import { AgenticAICard, Avatar, Link, Tag } from "@nicecxone/lyra-ui";
import { User } from "lucide-react";
import { LinkCustomerButton } from "@/components/customer-info/reference-sections";
import type { OverviewInfo } from "@/components/agent-next-gen-shared-utils";
import { t } from "@/i18n";
import { aiCardIcon as ic } from "./ai-card-icon";
import type { ReferenceAccordionProps } from "./RealTimeSummaryCard";

/** Customer Info (P-CANVAS): the customer's identity block as lyra's AICard
 *  "Customer Info · conversational" story draws it — avatar, name, their
 *  subline ("Insider since 2023 · 14 orders") and the chips (sentiment, then
 *  the record's tags: tier, segments, preferences; the same data as
 *  `CustomerContextOverview`'s customer profile) — without its summary
 *  paragraphs, then "View customer info". An unmatched customer's "Link to
 *  existing customer" stays visible with the card collapsed. */
export function CustomerInfoCard({
  customerName,
  customerCard,
  onViewCustomerInfo,
  onLinkCustomer,
  open,
  onOpenChange,
}: ReferenceAccordionProps & {
  customerName?: string;
  /** The record's identity block; none for an unmatched customer. */
  customerCard?: OverviewInfo["customerCard"];
  onViewCustomerInfo?: () => void;
  onLinkCustomer?: () => void;
}) {
  const known = !!customerCard;
  return (
    <div data-slot="customer-info-card">
      <AgenticAICard
        title={t("Customer Info")}
        icon={ic(User)}
        status={known ? "done" : "needs-you"}
        statusLabel={known ? t("On file") : t("Not linked")}
        open={open}
        onOpenChange={onOpenChange}
        persistentFooter={!known && onLinkCustomer ? <LinkCustomerButton onLinkCustomer={onLinkCustomer} /> : undefined}
      >
        {customerCard ? (
          // lyra's AICard "Customer Info · conversational" story, without its summary paragraphs.
          <div className="flex flex-col gap-3" data-slot="customer-block">
            <div className="flex items-center gap-4" data-slot="customer-identity">
              {customerCard.avatarInitials && <Avatar initials={customerCard.avatarInitials} size="lg" color="success" aria-label={customerName} />}
              <div className="min-w-0">
                <p className="lyra-body-lg-emphasis text-lyra-fg-default">{customerName}</p>
                <p className="lyra-body-md text-lyra-fg-secondary" data-slot="customer-subline">
                  {customerCard.subtitle}
                </p>
              </div>
            </div>
            {(customerCard.sentiment || (customerCard.tags?.length ?? 0) > 0) && (
              <div className="flex flex-wrap gap-2" data-slot="customer-chips">
                {customerCard.sentiment && (
                  <Tag
                    label={t("{label} · {value}", { label: customerCard.sentiment.label ?? t("Sentiment"), value: customerCard.sentiment.value })}
                    variant="warning"
                    shape="pill"
                  />
                )}
                {customerCard.tags?.map((tag) => <Tag key={tag} label={tag} variant="info" shape="pill" />)}
              </div>
            )}
            {onViewCustomerInfo && (
              <Link onClick={onViewCustomerInfo} className="self-start">
                {t("View customer info")}
              </Link>
            )}
          </div>
        ) : (
          <p className="lyra-body-md text-lyra-fg-secondary">{t("This contact isn't linked to a customer record yet.")}</p>
        )}
      </AgenticAICard>
    </div>
  );
}
