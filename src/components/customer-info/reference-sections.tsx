// What the reference cards read (P-CANVAS). The cards themselves are the
// Agentic AI cards (`src/components/ai-cards/`), one implementation each,
// mounted by the canvas registry's reference cells under every AI display:
// the reference column (inline and main) or Contact Details' Overview (panel).
import { Button } from "@nicecxone/lyra-ui";
import type { OverviewInfo } from "@/components/agent-next-gen-shared-utils";

/** What the reference cards read: the same object each page builds via
 *  `buildCustomerContextOverviewInfo`, passed through so the cards never
 *  disagree with the rest of the page. */
export interface ReferenceCardProps {
  customerName?: string;
  customerContextOverview?: OverviewInfo;
  /** Adds a "View Experience Memory" link to the Journey Summary card. */
  onViewExperienceMemory?: () => void;
  /** "View customer info" on the Customer Info card; omit to hide it. */
  onViewCustomerInfo?: () => void;
  onViewInteractionHistory?: () => void;
  /** An unmatched customer's "Link to existing customer" button; the caller owns what a click does. Omit to hide it. */
  onLinkCustomer?: () => void;
  /** Side panels the agent has opened on this interaction — listed as links in the Journey Summary's Artifacts; clicking re-opens one. */
  artifacts?: readonly { id: string; label: string }[];
  onOpenArtifact?: (id: string) => void;
  /** Fired by "View All" (only shown when more than 10 artifacts are listed). */
  onViewAllArtifacts?: () => void;
}

/** "Link to existing customer", for an unmatched customer. */
export function LinkCustomerButton({ onLinkCustomer }: Pick<ReferenceCardProps, "onLinkCustomer">) {
  if (!onLinkCustomer) return null;
  return (
    <Button variant="outline" className="w-full" onClick={onLinkCustomer}>
      Link to existing customer
    </Button>
  );
}

/** Whether the Customer Info card has anything to show: a customer record
 *  ("if a new call is made or the customer does not have any information,
 *  do not display the customer profile"). */
export const hasCustomerInfo = (p: ReferenceCardProps) => !!p.customerContextOverview?.customerCard;
