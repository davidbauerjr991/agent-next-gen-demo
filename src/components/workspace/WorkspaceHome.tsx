import { Button, InteriorPanel, Tooltip } from "@nicecxone/lyra-ui";
import { ChevronRight, CircleAlert } from "lucide-react";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useActiveScheduleItem, useRailAssignmentCount } from "@/contact-handling/home/useScheduleCards";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { homeIsTwoColumn } from "@/contact-handling/home/home-layout";
import { KindCell } from "./kind-cells/KindCell";
import { AppTabBody, CustomerTabBodies, CustomersTabBody, HomeTabStrip } from "@/components/home-tabs";
import { isCustomerTab, keptMountedClass } from "@/components/home-tabs-state";
import { HomeDashboard } from "@/components/home-dashboard";
import { useHomeDetailPanel } from "@/components/home/home-detail-panel";
import { CUSTOMER_PANEL_TABS } from "@/components/customer-info";
import { ContactHistoryCard } from "@/components/agent-next-gen-contact-history";
import { tabOrderPatch, useSettings } from "@/settings";
import { cn } from "@/lib/utils";

/** Home's docked detail panel in one column (two columns mount the same
 *  parts over the right column, HomeTwoColumn). */
function HomeDockedDetailPanel() {
  const { wanted, onClose, header, body } = useHomeDetailPanel();
  return (
    <InteriorPanel side="right" open={wanted} onClose={onClose} {...header}>
      {body}
    </InteriorPanel>
  );
}

/** Home: the Home tabs and the dashboard with its docked detail panel
 *  (P-EXTRACT C8, from the page). */
export function WorkspaceHome() {
  const {
    activeDeskTab, addToast, contactHistory, contentByPanelKey, customerTable,
    handleStartCall, hasBreachedSlaAssignment, homeTabs,
    interactions, selectedContactHistoryEntry, selectedQueueId,
    setInteriorPanelOpen, setNavOpen, setSelectedContactHistoryEntry, setSelectedQueueId, showInteriorPanel,
    showPageHeader, tabApps, updateHeaderSettings,
  } = useWorkspace();
  const [home] = useSettings("home");
  const [, setHomePreview] = useWorkspaceUiField("homePreview");
  // The rail's count: conversation cards and kind cards alike.
  const railCount = useRailAssignmentCount();
  // P-HOME-1: an opened schedule item (meeting, training, task, …) isn't a conversation card, so the page lands
  // here; its minimal per-kind cell takes the main column until P-HOME-3's kinds registry.
  const activeScheduleItem = useActiveScheduleItem();
  if (activeScheduleItem) return <KindCell key={activeScheduleItem.id} item={activeScheduleItem} />;
  return (
                <div key="dashboard" className="flex flex-1 flex-col min-w-0 overflow-hidden animate-in fade-in-0 duration-200">
              {/* Home tabs: shown while any app is placed as "tab" (Settings → Header). */}
              {showPageHeader && tabApps.length > 0 && (
                <HomeTabStrip
                  tabs={homeTabs}
                  apps={tabApps}
                  onReorder={(order) => updateHeaderSettings((prev) => tabOrderPatch(prev, order))}
                />
              )}
              {/* Body row: main content + interior panel */}
              <div className="relative flex flex-1 overflow-hidden">
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
                  showPageHeader={showPageHeader}
                  selectedQueueId={selectedQueueId}
                  // Only one job at a time in the shared docked slot: a queue
                  // click replaces a Contact History entry's summary.
                  onSelectQueue={(id) => {
                    setSelectedContactHistoryEntry(null);
                    setHomePreview(null);
                    setSelectedQueueId(id);
                  }}
                  headerActions={
                            <Tooltip content="Toggle Assignment Panel" placement="bottom" asLabel>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setNavOpen((v) => !v)}
                                className={cn(
                                  "h-6 shrink-0 gap-0.5 rounded-lyra-md px-2 lyra-body-md-emphasis",
                                  hasBreachedSlaAssignment
                                    ? "bg-lyra-status-critical-subtle text-lyra-status-critical-strong hover:bg-lyra-status-critical-subtle hover:opacity-80"
                                    : railCount > 0
                                    ? "bg-lyra-status-warning-subtle text-lyra-status-warning-strong hover:bg-lyra-status-warning-subtle hover:opacity-80"
                                    : "bg-lyra-status-success-subtle text-lyra-status-success-strong hover:bg-lyra-status-success-subtle hover:opacity-80"
                                )}
                              >
                                My Assignment Queue: {railCount > 0 ? railCount : "Empty"}
                                {hasBreachedSlaAssignment && (
                                  <CircleAlert className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                                )}
                                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                              </Button>
                            </Tooltip>
                  }
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
                {showInteriorPanel && !homeIsTwoColumn(home) && <HomeDockedDetailPanel />}
                </>
              ))}
              </div>
                </div>
  );
}
