// Home tabs (P0.5d.2, ported from Desk): Dashboard, then each app placed as
// "tab" (Settings → Header), then any customer opened full screen from the
// Customers tab's row panel.
import { useEffect, useRef, useState } from "react";
import type { ExtraHeaderApp } from "@/settings";
import type { CustomerListRecord } from "@/components/agent-next-gen-customers-table";

export type CustomerTabId = `customer:${string}`;
export type HomeTabId = "dashboard" | ExtraHeaderApp | CustomerTabId;

export interface CustomerTab {
  id: CustomerTabId;
  name: string;
  row: CustomerListRecord;
}

export const HOME_APP_TAB_LABELS: Record<ExtraHeaderApp, string> = {
  customers: "Customers",
  accounts: "Accounts",
  tickets: "Tickets",
  wem: "WEM",
  schedule: "Schedule",
  screenpop: "Screen Pop",
};

/** Keeps a tab body mounted while another tab shows, so its own state
 *  (scroll, a customer's tabs and drafts) survives switching. Hidden with
 *  opacity and `inert`, not `display:none` (a zero size would make the row
 *  panel's `InteriorPanel` flash full screen on the way back). */
export const keptMountedClass = (shown: boolean) =>
  shown ? "relative flex flex-1 overflow-hidden animate-in fade-in-0 duration-200" : "absolute inset-0 flex overflow-hidden opacity-0";

export const isCustomerTab =(id: HomeTabId): id is CustomerTabId => id.startsWith("customer:");

/** Which Home tab is showing, and the open customer tabs. `tabApps` are the
 *  apps placed as tabs; when the active app stops being one, Home falls back
 *  to Dashboard. */
export function useHomeTabs(tabApps: readonly ExtraHeaderApp[]) {
  const [active, setActive] = useState<HomeTabId>("dashboard");
  const [customerTabs, setCustomerTabs] = useState<CustomerTab[]>([]);
  // Where closing the last customer tab returns to (where the first opened from).
  const returnTo = useRef<HomeTabId>("customers");

  // Customer tabs open from the Customers tab; without it they close too.
  const customersTabbed = tabApps.includes("customers");
  useEffect(() => {
    if (!customersTabbed) setCustomerTabs([]);
  }, [customersTabbed]);

  const shown =
    active === "dashboard" ||
    (isCustomerTab(active) ? customersTabbed && customerTabs.some((t) => t.id === active) : tabApps.includes(active));
  const activeTab: HomeTabId = shown ? active : "dashboard";

  const openCustomer = (row: CustomerListRecord) => {
    const id: CustomerTabId = `customer:${row.contactNumber}`;
    setCustomerTabs((prev) => (prev.some((t) => t.id === id) ? prev : [...prev, { id, name: `${row.firstName} ${row.lastName}`, row }]));
    if (!isCustomerTab(activeTab)) returnTo.current = activeTab;
    setActive(id);
  };

  const closeCustomer = (id: CustomerTabId) => {
    const next = customerTabs.filter((t) => t.id !== id);
    setCustomerTabs(next);
    // Closing the shown tab lands on the newest remaining customer tab, else
    // where the first one was opened from.
    if (activeTab === id) setActive(next.length > 0 ? next[next.length - 1].id : returnTo.current);
  };

  return { activeTab, setActiveTab: setActive, customerTabs, openCustomer, closeCustomer };
}

export type HomeTabs = ReturnType<typeof useHomeTabs>;
