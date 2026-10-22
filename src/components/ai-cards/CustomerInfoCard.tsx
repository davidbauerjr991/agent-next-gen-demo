import { AgenticAICard, Link } from "@nicecxone/lyra-ui";
import { User } from "lucide-react";
import { LinkCustomerButton } from "@/components/customer-info/reference-sections";
import { t } from "@/i18n";
import { aiCardIcon as ic } from "./ai-card-icon";
import type { ReferenceAccordionProps } from "./RealTimeSummaryCard";

/** Customer Info (P-CANVAS): the header and its status, and a body that's
 *  only the way into the customer's record — "View customer info", or an
 *  unmatched customer's "Link to existing customer". The facts live in
 *  Contact Details' Customer Information tab. */
export function CustomerInfoCard({
  known,
  onViewCustomerInfo,
  onLinkCustomer,
  open,
  onOpenChange,
}: ReferenceAccordionProps & {
  known: boolean;
  onViewCustomerInfo?: () => void;
  onLinkCustomer?: () => void;
}) {
  return (
    <div data-slot="customer-info-card">
      <AgenticAICard
        title={t("Customer Info")}
        icon={ic(User)}
        status={known ? "done" : "needs-you"}
        statusLabel={known ? t("On file") : t("Not linked")}
        open={open}
        onOpenChange={onOpenChange}
        // An unmatched customer's way in stays visible with the card collapsed.
        persistentFooter={!known && onLinkCustomer ? <LinkCustomerButton onLinkCustomer={onLinkCustomer} /> : undefined}
      >
        {known && onViewCustomerInfo ? (
          <Link onClick={onViewCustomerInfo} className="self-start">
            {t("View customer info")}
          </Link>
        ) : (
          !known && <p className="lyra-body-md text-lyra-fg-secondary">{t("This contact isn't linked to a customer record yet.")}</p>
        )}
      </AgenticAICard>
    </div>
  );
}
