import type { CreateNewOutboundConfig } from "@nicecxone/lyra-ui";
import type { LauncherTab } from "@/settings";

type Group = CreateNewOutboundConfig["groups"][number];

/** Launcher tabs with nothing behind them yet: stored for the CXone mapping,
 *  never rendered. Agents, Skills and Teams need the DirectoryProvider
 *  (P0.9); Search is the search field every tab already has. */
export const INERT_LAUNCHER_TABS: readonly LauncherTab[] = ["search", "agents", "skills", "teams"];

/** The launcher's groups, in order, for the enabled tabs:
 *  - `dialpad`: the Dial Pad, while Ad-hoc calling is allowed;
 *  - `all`: every customer (the Customers group, labeled "All");
 *  - `favorites`: starred contacts, and a typed search across everyone (group id "all");
 *  - `addressBook`: the Address Book group. */
export function launcherGroups(
  groups: readonly Group[],
  tabs: Record<LauncherTab, boolean>,
  adHoc: boolean,
  addressBook: Group,
): Group[] {
  const byId = (id: string) => groups.find((g) => g.id === id);
  const out: Group[] = [];
  const dialpad = byId("dialpad");
  if (tabs.dialpad && adHoc && dialpad) out.push(dialpad);
  const customers = byId("customers");
  if (tabs.all && customers) out.push({ ...customers, id: "all-customers", label: "All" });
  const favorites = byId("all");
  if (tabs.favorites && favorites) out.push(favorites);
  if (tabs.addressBook) out.push(addressBook);
  return out;
}
