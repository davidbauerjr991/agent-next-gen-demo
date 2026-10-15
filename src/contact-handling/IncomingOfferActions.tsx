import type { MouseEvent, ReactNode } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@nicecxone/lyra-ui";

// The ringing tile's Accept/Decline (P0.5d.1), rendered in a nav card's
// `footerAction` on both pages — for provider voice offers and for the
// scripted Tom Lewis call alike. `originBadge`/`reason` are for P6.4's
// "Escalated from virtual agent" and are unused for now.

export interface IncomingOfferActionsProps {
  onAccept: () => void;
  /** Omit to hide Decline (the provider can't decline). */
  onDecline?: () => void;
  originBadge?: ReactNode;
  reason?: string;
}

export function IncomingOfferActions({ onAccept, onDecline, originBadge, reason }: IncomingOfferActionsProps) {
  const stop = (handler: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    handler();
  };
  return (
    <div className="flex flex-col gap-2">
      {(originBadge || reason) && (
        <div className="flex flex-col gap-1">
          {originBadge}
          {reason && <p className="lyra-body-sm text-lyra-fg-secondary">{reason}</p>}
        </div>
      )}
      <div className="flex flex-row-reverse gap-2">
        <Button variant="default" size="md" className="flex-1" onClick={stop(onAccept)}>
          <Phone className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Accept
        </Button>
        {onDecline && (
          <Button variant="destructive" size="md" className="flex-1" onClick={stop(onDecline)}>
            <PhoneOff className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Decline
          </Button>
        )}
      </div>
    </div>
  );
}
