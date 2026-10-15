import { useState } from "react";
import { CreateNew, type ChannelType, type CreateNewOutboundConfig, type CreateNewOutboundContact } from "@nicecxone/lyra-ui";
import { addressBookGroup, type AddressBook } from "./address-books";
import type { LauncherTab } from "@/settings";
import { launcherGroups } from "./launcher-groups";
import type { DialpadRequest } from "./useOutboundDial";

/** The left nav's "New Outbound" launcher. Its tabs come from Settings →
 *  New Outbound (`outbound.launcher`, CXone's Directory App names) and the
 *  Dial Pad also needs Outbound Calling → Ad-hoc. With one tab it opens
 *  straight on it (no group list); with none it isn't shown. It stays
 *  enabled during a call: a second call holds the first (the provider's
 *  auto-hold). Everything a launch does goes through `useOutboundDial`. */
export interface NewOutboundLauncherProps {
  /** The page's outbound config (groups tagged with open channels). */
  outboundConfig: CreateNewOutboundConfig;
  tabs: Record<LauncherTab, boolean>;
  /** Outbound Calling → Ad-hoc: the Dial Pad accepts a typed number. */
  adHoc: boolean;
  addressBooks: readonly AddressBook[];
  expanded: boolean;
  onStartCall: (selection: { contact: CreateNewOutboundContact; channel: ChannelType; phone: string; skillId: string }) => void;
  onQuickDial: (phoneNumber: string, skillId: string) => void;
  dialpadRequest: DialpadRequest | null;
  onDialpadRequestHandled: () => void;
}

export function NewOutboundLauncher({
  outboundConfig,
  tabs,
  adHoc,
  addressBooks,
  expanded,
  onStartCall,
  onQuickDial,
  dialpadRequest,
  onDialpadRequestHandled,
}: NewOutboundLauncherProps) {
  const [addressBookId, setAddressBookId] = useState("");
  const groups = launcherGroups(outboundConfig.groups, tabs, adHoc, addressBookGroup(addressBooks, addressBookId, setAddressBookId));
  if (groups.length === 0) return null;
  const scoped: Partial<CreateNewOutboundConfig> = {
    groups,
    defaultGroupId: groups.some((g) => g.id === "all") ? "all" : groups[0].id,
    skipGroupPicker: groups.length === 1,
  };
  return (
    <CreateNew
      // CreateNew picks its starting screen (straight to a lone tab, or the
      // group list) at mount: a changed tab set remounts it.
      key={groups.map((g) => g.id).join(",")}
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
    />
  );
}
