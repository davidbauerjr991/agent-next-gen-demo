import { CustomerContextOverview } from "@nicecxone/lyra-ui";
import { AI_CARD_ENTER } from "@/components/agent-next-gen-transcript";

/** The Autosummary: one standalone AI card in every placement — the inline
 *  main column, the AI feed (panel and "main"), a thread view (the panel, a
 *  hover preview). Blue header (Customer Info's token), the AI cards' shared
 *  enter animation, replayed per card (`cardKey`). */
export function AutosummaryCard({
  cardKey,
  customerName,
  snapshot,
  onSnapshotLink,
}: {
  cardKey: string;
  customerName: string;
  snapshot: readonly string[];
  onSnapshotLink?: (key: string) => void;
}) {
  return (
    <div key={cardKey} className={AI_CARD_ENTER} data-slot="autosummary">
      <CustomerContextOverview
        aiCards
        customerName={customerName}
        snapshot={[...snapshot]}
        onSnapshotLink={onSnapshotLink}
        autosummaryBlue
        showCustomerProfile={false}
        showContactSnapshot
        showNextBestAction={false}
        className="pt-0"
      />
    </div>
  );
}
