import type { MouseEvent } from "react";
import { Pause } from "lucide-react";
import { Badge, Button, getHoldSeverity, Tooltip } from "@nicecxone/lyra-ui";

// The nav row's actionable hold chip (P0.5d.1), shared by both pages and
// rendered in lyra `ChannelRow`'s `statusBadge` slot. On a held call it reads
// "On hold · mm:ss" (colored by the hold SLA, like the old badge) and resumes
// the call; on the live call it reads "Hold" and holds it. One click, no
// menu; the state flips when the provider's event arrives. A lyra `Button`
// wrapping a pill `Badge` (the session status pill's composition), so it gets
// the ghost button's hover/press states and focus ring. Stops propagation so
// the click doesn't also select the row or switch cards. Tooltip "Put Call On
// Hold" / "Take Off Hold"; the aria-label is the same text plus the caller.

export interface VoiceHoldChipProps {
  held: boolean;
  /** Seconds on hold, for the label and SLA color (held only). */
  heldSeconds?: number;
  /** Already formatted "mm:ss" of `heldSeconds` (held only). */
  heldLabel?: string;
  callerName: string;
  onClick: () => void;
}

export function VoiceHoldChip({ held, heldSeconds = 0, heldLabel, callerName, onClick }: VoiceHoldChipProps) {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    onClick();
  };
  const action = held ? "Take Off Hold" : "Put Call On Hold";
  return (
    <Tooltip content={action} placement="top">
      <Button variant="ghost" size="sm" className="h-auto rounded-full p-0" aria-label={`${action}, ${callerName}`} onClick={handleClick}>
        <Badge
          shape="pill"
          color={held ? getHoldSeverity(heldSeconds) : "slate"}
          variant="subtle"
          fontSize={12}
          icon={<Pause strokeWidth={2} />}
        >
          {held ? `On hold · ${heldLabel ?? ""}` : "Hold"}
        </Badge>
      </Button>
    </Tooltip>
  );
}
