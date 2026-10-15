import { useEffect } from "react";
import type { ChannelKind } from "@/domain";
import { useAgentState, useInteractionProvider } from "@/provider-context";
import { isProviderError } from "@/adapters/provider-error";

/** Settings → Channels → the provider's agent channels (like
 *  `usePresenceSync`): routing offers contacts only on these. Sent on mount
 *  without waiting for the agent snapshot, so routing never runs a moment
 *  on "every channel"; resent whenever the snapshot disagrees. */
export function useChannelSync(channels: readonly ChannelKind[]): void {
  const provider = useInteractionProvider();
  const agent = useAgentState();
  const wanted = [...channels].sort().join(",");
  const current = agent?.channels ? [...agent.channels].sort().join(",") : null;
  useEffect(() => {
    if (current === wanted) return;
    const next = (wanted ? wanted.split(",") : []) as ChannelKind[];
    provider.setAgentChannels(next).catch((error) => {
      // A provider without agent channels (a placeholder) has nothing to sync.
      if (isProviderError(error) && error.code === "not-supported") return;
      if (import.meta.env.DEV) console.warn(`[channels] setAgentChannels(${wanted}) failed`, error);
    });
  }, [current, wanted, provider]);
}
