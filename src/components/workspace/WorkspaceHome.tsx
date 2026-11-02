import { LYRA_CONTAINER_GRID_STACK_MAX_WIDTH } from "@nicecxone/lyra-ui";
import { ACTION_AREA_MIN_WIDTH } from "@/contact-handling/canvas-registry";
import { Slot } from "@/layout/Slot";
import { ReferenceSlotFrame } from "./ReferenceSlot";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useActiveScheduleItem } from "@/contact-handling/home/useScheduleCards";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { homeIsTwoColumn } from "@/contact-handling/home/home-layout";
import { KindCell } from "./kind-cells/KindCell";
import { AppTabBody, CustomerTabBodies, CustomersTabBody, HomeTabStrip } from "@/components/home-tabs";
import { isCustomerTab, keptMountedClass } from "@/components/home-tabs-state";
import { HomeDashboard } from "@/components/home-dashboard";
import { HomePageHeader } from "@/components/home/HomePageHeader";
import { useHomeDetailPanel } from "@/components/home/home-detail-panel";
import { CUSTOMER_PANEL_TABS } from "@/components/customer-info";
import { ContactHistoryCard } from "@/components/agent-next-gen-contact-history";
import { tabOrderPatch, useSettings } from "@/settings";

/** One column's cards stay 2-up while the grid's container is wider than lyra's stack width (`.lyra-container-grid`);
 *  the row is that container plus the dashboard's `px-6` on both sides. `fitsBeside` already holds the action area's
 *  minimum, so only the excess is reserved. */
const HOME_CARDS_RESERVED = LYRA_CONTAINER_GRID_STACK_MAX_WIDTH + 1 + 2 * 24 - ACTION_AREA_MIN_WIDTH;

/** Home's detail panel in one column (the queue drill-down, a History entry, a feed preview): the reference slot's
 *  frame with no column, so it docks beside the whole page column while it fits and overlays the body when it
 *  doesn't, as two columns' (HomeTwoColumn) and the interaction's slide-over do (P-LAYOUT-F3 4). */
function HomeDetailPanel() {
  return <ReferenceSlotFrame panel={useHomeDetailPanel()} bodyReserved={HOME_CARDS_RESERVED} />;
}

/** Home: the Home tabs and the dashboard with its docked detail panel
 *  (P-EXTRACT C8, from the page). */
export function WorkspaceHome() {
  const {
    activeDeskTab, addToast, contactHistory, contentByPanelKey, customerTable,
    handleStartCall, homeTabs,
    interactions, selectedContactHistoryEntry, selectedQueueId,
    setInteriorPanelOpen, setSelectedContactHistoryEntry, setSelectedQueueId, showInteriorPanel,
    showPageHeader, tabApps, updateHeaderSettings,
  } = useWorkspace();
  const [home] = useSettings("home");
  const [{ parts }] = useSettings("layout");
  const [, setHomePreview] = useWorkspaceUiField("homePreview");
  // P-HOME-1: an opened schedule item (meeting, training, task, …) isn't a conversation card, so the page lands
  // here; its minimal per-kind cell takes the main column until P-HOME-3's kinds registry.
  const activeScheduleItem = useActiveScheduleItem();
  if (activeScheduleItem) return <KindCell key={activeScheduleItem.id} item={activeScheduleItem} />;
  return (
                <div key="dashboard" className="flex flex-1 flex-col min-w-0 overflow-hidden animate-in fade-in-0 duration-200">
              {/* The page header, its tabs row Home's tabs, then the tab's body (P-LAYOUT-F3 2: lyra PageHeader in every
                  layout). Its actions are the home-top slot's (the queue chip); the tabs show while any app is placed
                  as "tab" (Workspace → Header & apps). */}
              {showPageHeader && (
                <HomePageHeader
                  actions={<Slot id="home-top" region="page-header" />}
                  tabs={
                    tabApps.length > 0 ? (
                      <HomeTabStrip tabs={homeTabs} apps={tabApps} onReorder={(order) => updateHeaderSettings((prev) => tabOrderPatch(prev, order))} />
                    ) : undefined
                  }
                />
              )}
              {/* (The home-top slot's parts are the tab strip's tabs above and the page header's queue chip; its
                  assignments rows, placement "none", became the Active assignments section in P-LAYOUT-F1 B.) */}
              {/* Body row: main content + interior panel, full width. Only the Dashboard centres its content at
                  `home.contentWidth` inside its scroller (`useHomeContentWidth`, P-LAYOUT-F3 3); the app tabs (Customers,
                  Accounts, Tickets, …) are full width (F4-2), and so is the header above. */}
              <div className="relative flex flex-1 overflow-hidden" data-home-body="">

              {/* The Customers tab (table + row panel) and the customer tabs
                  stay mounted while another Home tab shows, so their state
                  survives switching (`keptMountedClass`). Mounted only while
                  Customers is a tab: on Phase 1 Home has none of this. */}
              {tabApps.includes("customers") && (
                <CustomersTabBody
                  className={keptMountedClass(activeDeskTab === "customers")}
                  inert={activeDeskTab !== "customers"}
                  table={customerTable}
                  tabs={CUSTOMER_PANEL_TABS}
                  onStartInteraction={(contact, channel, phone, skillId) => handleStartCall({ contact, channel, phone, skillId })}
                  onAddToast={addToast}
                  onRowClick={customerTable.toggleRow}
                  onOpenFullScreenTab={homeTabs.openCustomer}
                  isRowOpen={(row) =>
                    interactions.some((i) => i.customerId === row.contactNumber) ||
                    homeTabs.customerTabs.some((t) => t.row.contactNumber === row.contactNumber)
                  }
                />
              )}
              <CustomerTabBodies
                tabs={homeTabs}
                onStartInteraction={(contact, channel, phone, skillId) => handleStartCall({ contact, channel, phone, skillId })}
                onAddToast={addToast}
              />
              {activeDeskTab !== "customers" && !isCustomerTab(activeDeskTab) && (activeDeskTab !== "dashboard" ? (
                // Any other tab-placed app shows its header-panel content.
                <AppTabBody key={activeDeskTab} content={contentByPanelKey[activeDeskTab]} />
              ) : (
                <>
                <HomeDashboard
                  key={activeDeskTab}
                  selectedQueueId={selectedQueueId}
                  // Only one job at a time in the shared docked slot: a queue
                  // click replaces a Contact History entry's summary.
                  onSelectQueue={(id) => {
                    setSelectedContactHistoryEntry(null);
                    setHomePreview(null);
                    setSelectedQueueId(id);
                  }}
                  contactHistory={
                      <ContactHistoryCard
                        onSelectEntry={(entry) => {
                          // Clicking the selected row again closes the panel, as the queue tiles' `selectedId`/`onSelect` do.
                          if (entry.id === selectedContactHistoryEntry?.id) {
                            setSelectedContactHistoryEntry(null);
                            return;
                          }
                          // One job at a time in the shared panel slot (home-detail-panel.tsx).
                          setSelectedQueueId(null);
                          setInteriorPanelOpen(false);
                          setHomePreview(null);
                          setSelectedContactHistoryEntry(entry);
                        }}
                        selectedEntryId={selectedContactHistoryEntry?.id ?? null}
                        history={contactHistory}
                        // The whole seeded history at first (lyra's Last 7 days).
                        defaultDateFilter="last7"
                        // No `onOpenAllContacts`: the card's "All Contacts" button is off on Home by request.
                      />
                  }
                />
                {showInteriorPanel && !homeIsTwoColumn(home, parts) && <HomeDetailPanel />}
                </>
              ))}
              </div>
                </div>
  );
}
