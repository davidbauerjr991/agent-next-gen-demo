// The standalone host (P-EXTRACT): today's values. The signed-in agent is
// the workspace's own; there is no host context (the Workspace's selection
// is the context) unless a getter is supplied; posting goes nowhere. Not in
// `ProviderSet` yet: P-EMBED wires the host in.
import { CURRENT_AGENT_ID, CURRENT_AGENT_NAME } from "@/components/agent-next-gen-shared-utils";
import type { HostContext, HostProvider, HostSession } from "@/providers/host-provider";

export function createStandaloneHostProvider(
  options: { session?: HostSession; getContext?: () => HostContext } = {},
): HostProvider {
  const session = options.session ?? { agentId: CURRENT_AGENT_ID, displayName: CURRENT_AGENT_NAME };
  return {
    hostKind: "standalone",
    getSession: async () => ({ ...session }),
    getContext: async () => ({ ...(options.getContext?.() ?? {}) }),
    postToHost: async () => {},
  };
}
