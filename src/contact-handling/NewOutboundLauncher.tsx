import { CreateNew, type ChannelType, type CreateNewOutboundConfig, type CreateNewOutboundContact } from "@nicecxone/lyra-ui";
import { HIDDEN_OUTBOUND_GROUP_IDS } from "@/components/agent-next-gen-outbound-data";
import type { DialpadRequest } from "./useOutboundDial";

/** The left nav's "New Outbound" launcher, shared by both workspace pages.
 *
 *  Group scope and the in-call rule are per-page options — a deliberate,
 *  temporary parity exception (PROGRESS.md parity rows 14/15): Advanced
 *  passes `scope="dialpad"` and `inCallPolicy="disable"`; Desk passes its
 *  full picker and `inCallPolicy="allow"` (a second call auto-holds the
 *  first, in the provider). Everything a launch does goes through
 *  `useOutboundDial`. */
export interface NewOutboundLauncherProps {
  /** The page's outbound config (groups tagged with open channels). */
  outboundConfig: CreateNewOutboundConfig;
  /** "dialpad": Dial Pad only, no group picker. "full": every group except
   *  `HIDDEN_OUTBOUND_GROUP_IDS`. */
  scope: "dialpad" | "full";
  inCallPolicy: "disable" | "allow";
  /** The agent is on a live voice call. */
  onActiveCall: boolean;
  expanded: boolean;
  onStartCall: (selection: { contact: CreateNewOutboundContact; channel: ChannelType; phone: string; skillId: string }) => void;
  onQuickDial: (phoneNumber: string, skillId: string) => void;
  dialpadRequest: DialpadRequest | null;
  onDialpadRequestHandled: () => void;
}

export function NewOutboundLauncher({
  outboundConfig,
  scope,
  inCallPolicy,
  onActiveCall,
  expanded,
  onStartCall,
  onQuickDial,
  dialpadRequest,
  onDialpadRequestHandled,
}: NewOutboundLauncherProps) {
  const scoped: Partial<CreateNewOutboundConfig> =
    scope === "dialpad"
      ? {
          groups: outboundConfig.groups.filter((group) => group.id === "dialpad"),
          defaultGroupId: "dialpad",
          skipGroupPicker: true,
        }
      : { groups: outboundConfig.groups.filter((group) => !HIDDEN_OUTBOUND_GROUP_IDS.includes(group.id)) };
  const disabled = inCallPolicy === "disable" && onActiveCall;
  return (
    <CreateNew
      title="New Outbound"
      outbound={{
        ...outboundConfig,
        ...scoped,
        onStartCall,
        onQuickDial,
        dialpadRequest,
        onDialpadRequestHandled,
      }}
      expanded={expanded}
      {...(inCallPolicy === "disable" ? { disabled, disabledReason: "A call is already in progress" } : {})}
    />
  );
}
