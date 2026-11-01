import { CircleCheck } from "lucide-react";
import { Badge } from "@nicecxone/lyra-ui";
import { useElapsedSince } from "@/components/agent-next-gen-page-clock";

/** A voice row whose call has ended and is in wrap-up, waiting for the
 *  agent's outcome (P0.5d.1). The nav row's on-hold chip style in the info
 *  color, passed to lyra `ChannelRow`'s `statusBadge` slot (its own line
 *  below the skill name; the call timer stays put). Its after-call work time
 *  ticks here, from `since` (the page clock's wrap-up start): only the badge
 *  re-renders each second, not the card (P-LAYOUT-F2 8). */
export function NeedsOutcomeBadge({ since }: { since: number }) {
  const elapsed = useElapsedSince(since);
  return (
    <Badge
      shape="pill"
      color="info"
      variant="subtle"
      fontSize={12}
      icon={<CircleCheck strokeWidth={2} />}
      aria-label={`Call ended, needs outcome, ${elapsed} in wrap-up`}
    >
      Needs outcome · {elapsed}
    </Badge>
  );
}
