// The reference cards (P-CANVAS): Customer Info, Journey Summary and
// Artifacts, one component each. `DetailsPanelAccordions` composes them for
// AI display "panel" (Contact Details' Overview and Session tabs); the canvas
// registry mounts each as its own cell under inline and main. One
// implementation per card; the mode decides the mount.
import { useEffect, useState } from "react";
import { AICard, Button, CustomerContextOverview, Link } from "@nicecxone/lyra-ui";
import { Paperclip } from "lucide-react";
import { formatJourneySummaryUpdatedLabel, type OverviewInfo } from "@/components/agent-next-gen-shared-utils";
import { ClockValue } from "@/components/agent-next-gen-clock-tick";
import { AI_CARD_ENTER } from "@/components/transcript/ai-rows/ai-card-enter";
import { cn } from "@/lib/utils";

/** Per explicit request ("Files gets a placeholder"); text updated to
 *  match this section's later rename ("Files" → "Artifacts"). */
const FILES_EMPTY_TEXT = "No artifacts on this interaction yet.";

/** What the reference cards read: the same object each page builds via
 *  `buildCustomerContextOverviewInfo`, passed through so the cards never
 *  disagree with the rest of the page. */
export interface ReferenceCardProps {
  customerName?: string;
  customerContextOverview?: OverviewInfo;
  /** Shows the "Journey Summary" card (renamed from "Real-Time Summary")
   *  instead of the "Autosummary" one. Default `false`. */
  showJourneySummary?: boolean;
  /** Page-clock tick the Journey Summary was last "updated" at, turned into
   *  the "Updated 8 seconds ago" caption inside a `<ClockValue>`, so only
   *  that card re-renders as it ticks. */
  journeySummaryUpdatedAtTick?: number;
  /** Adds a "View Experience Memory" link to the Journey Summary card. */
  onViewExperienceMemory?: () => void;
  /** "View customer info" on the Customer Info card; omit to hide it. */
  onViewCustomerInfo?: () => void;
  onViewInteractionHistory?: () => void;
  /** An unmatched customer's "Link to existing customer" button, shown above
   *  the cards; the caller owns what a click does. Omit to hide it. */
  onLinkCustomer?: () => void;
  /** Side panels the agent has opened on this interaction — listed as links in the Artifacts card; clicking re-opens one. */
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

/** Customer Info: a plain accordion (not AI content). */
export function CustomerInfoSection({ customerName, customerContextOverview, onViewCustomerInfo, onViewInteractionHistory }: ReferenceCardProps) {
  if (!customerContextOverview?.customerCard) return null;
  return (
    <CustomerContextOverview
      customerName={customerName ?? ""}
      customerCard={customerContextOverview.customerCard}
      // Per explicit request ("put the customer summary content inside
      // the customer profile accordion") — see `detailedSummary`'s own
      // doc comment (lyra-ui/contact-overview.tsx) for what this renders.
      detailedSummary={customerContextOverview.detailedSummary}
      showCustomerProfile
      showContactSnapshot={false}
      showNextBestAction={false}
      onViewCustomerInfo={onViewCustomerInfo}
      onViewInteractionHistory={onViewInteractionHistory}
      className="pt-0"
    />
  );
}

/** The Journey Summary (or the Autosummary) as a lyra AICard (`aiCards`,
 *  71160d3). `customerContextOverview.journeySummary` is the same
 *  per-contact facts `snapshot` carries, joined into one paragraph by
 *  `buildCustomerContextOverviewInfo`; lyra's prop names still say
 *  "realTimeSummary". Enters with the other AI cards (`AI_CARD_ENTER`). */
export function JourneySummarySection({
  customerName,
  customerContextOverview,
  showJourneySummary = false,
  journeySummaryUpdatedAtTick,
  onViewExperienceMemory,
}: ReferenceCardProps) {
  if (!customerContextOverview) return null;
  return (
    // Only this card re-renders for the "Updated N seconds ago" caption, and
    // only when the label text changes (every second for the first minute,
    // then every minute).
    <ClockValue
      select={(clockTick) =>
        journeySummaryUpdatedAtTick === undefined ? undefined : formatJourneySummaryUpdatedLabel(clockTick - journeySummaryUpdatedAtTick)
      }
    >
      {(journeySummaryUpdatedLabel) => (
        <div className={AI_CARD_ENTER} data-slot="journey-summary">
          <CustomerContextOverview
            aiCards
            customerName={customerName ?? ""}
            snapshot={customerContextOverview.snapshot}
            showRealTimeSummary={showJourneySummary}
            showContactSnapshot={!showJourneySummary}
            realTimeSummary={customerContextOverview.journeySummary}
            realTimeSummaryUpdatedLabel={journeySummaryUpdatedLabel}
            onViewExperienceMemory={onViewExperienceMemory}
            showNextBestAction={false}
            showCustomerProfile={false}
            className="pt-0"
          />
        </div>
      )}
    </ClockValue>
  );
}

/** Artifacts: a blue lyra AICard (as v3 since lyra 71160d3), open by
 *  default. It joins the staggered fade/slide-up entrance
 *  `CustomerContextOverview` drives for its own cards (200ms + i*260ms,
 *  700ms) at `entranceIndex`. */
export function ArtifactsSection({
  artifacts,
  onOpenArtifact,
  onViewAllArtifacts,
  entranceIndex = 0,
}: ReferenceCardProps & { entranceIndex?: number }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), 200 + entranceIndex * 260);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <AICard
      title="Artifacts"
      color="blue"
      radius="md"
      density="compact"
      icon={<Paperclip className="h-4 w-4" strokeWidth={1.5} />}
      defaultOpen
      className={cn("transition-[opacity,transform] duration-700 ease-out", entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")}
    >
      <div className="flex flex-col gap-3">
        {artifacts && artifacts.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {artifacts.slice(0, 10).map((a) => (
              <li key={a.id} className="flex min-w-0 items-center gap-2">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
                <Link onClick={() => onOpenArtifact?.(a.id)} className="min-w-0 truncate text-left">
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lyra-body-md text-lyra-fg-secondary">{FILES_EMPTY_TEXT}</p>
        )}
        {/* "View All" sits below the artifact list, per explicit request. */}
        {artifacts && artifacts.length > 10 && (
          <Link onClick={onViewAllArtifacts} className="self-start">
            View All
          </Link>
        )}
      </div>
    </AICard>
  );
}
