import { createContext, useContext } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { AICard, Button } from "@nicecxone/lyra-ui";
import { answerSaveAddressOffer, linkContactMethod, saveAddressOfferAnswer, useContactMethodsVersion, type ContactMethodKind } from "./contact-methods";

export interface SaveAddressOffer {
  /** Whose contact methods it joins: the directory entity, else the card (P-EXTRACT, Bug 3). */
  ownerId: string;
  customerName: string;
  kind: ContactMethodKind;
  value: string;
  /** The card isn't a known customer: also offer Link to existing customer. */
  linkable?: boolean;
}

/** Opens the page's Link to existing customer flow for the card the offer is on. */
export const SaveAddressLinkContext = createContext<(() => void) | undefined>(undefined);

/** "Add (646) 555-0143 as a phone number for Alex Miller?" (P-AIFIRST (k8)
 *  8): an AI card in the feed when a thread starts on an address that isn't
 *  on the customer's record. Add writes it to their contact methods
 *  (`linkContactMethod`), so every picker offers it from then on; Not now
 *  dismisses the card. The answer outlives a remount (switching cards). On a
 *  card that isn't a known customer it also offers Link to existing customer. */
export function SaveAddressCard({ id, offer, timestamp }: { id: string; offer: SaveAddressOffer; timestamp: string }) {
  useContactMethodsVersion();
  const onLinkCustomer = useContext(SaveAddressLinkContext);
  const answer = saveAddressOfferAnswer(id);
  if (answer === "dismissed") return null;
  const noun = offer.kind === "phone" ? "a phone number" : "an email address";
  return (
    <div data-slot="save-address-card">
      <AICard
        title={
          <>
            Save new contact method <span className="lyra-body-md font-normal text-lyra-fg-secondary">{timestamp}</span>
          </>
        }
        radius="md"
        density="compact"
        icon={<Sparkles className="h-4 w-4" strokeWidth={1.5} />}
      >
        <div className="flex flex-col gap-3">
          <p className="lyra-body-md text-lyra-fg-default">
            Add {offer.value} as {noun} for {offer.customerName}?
          </p>
          <div data-ai-action="" className="flex flex-wrap items-center gap-2">
            {answer === "added" ? (
              <span className="inline-flex items-center gap-1.5 lyra-body-md-emphasis text-lyra-status-success-strong">
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                Added to {offer.customerName}&apos;s contact methods
              </span>
            ) : (
              <>
                <Button
                  variant="default"
                  size="md"
                  onClick={() => {
                    linkContactMethod(offer.ownerId, offer.kind, offer.value);
                    answerSaveAddressOffer(id, "added");
                  }}
                >
                  Add
                </Button>
                {offer.linkable && onLinkCustomer && (
                  <Button variant="outline" size="md" onClick={onLinkCustomer}>
                    Link to existing customer
                  </Button>
                )}
                <Button variant="outline" size="md" onClick={() => answerSaveAddressOffer(id, "dismissed")}>
                  Not now
                </Button>
              </>
            )}
          </div>
        </div>
      </AICard>
    </div>
  );
}
