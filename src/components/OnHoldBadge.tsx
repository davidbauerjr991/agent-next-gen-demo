import { CircleCheck } from "lucide-react";
import { Badge } from "@nicecxone/lyra-ui";

/** A voice row whose call has ended and is in wrap-up, waiting for the
 *  agent's outcome (P0.5d.1). The nav row's on-hold chip style in the info
 *  color, passed to lyra `ChannelRow`'s `statusBadge` slot (its own line
 *  below the skill name; the call timer stays put). `elapsed` is the
 *  after-call work time, formatted by the caller inside its `<ClockTick>`. */
export function NeedsOutcomeBadge({ elapsed }: { elapsed: string }) {
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
