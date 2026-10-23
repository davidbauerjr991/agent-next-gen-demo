import { Button, Icon, Input, InteriorPanel, Tooltip } from "@nicecxone/lyra-ui";
import { CheckCircle2, ChevronRight, CircleAlert, CircleDot, Clock, MinusCircle, PhoneOutgoing, RotateCcw } from "lucide-react";
import { DisabledReason } from "@/contact-handling";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { AppTabBody, CustomerTabBodies, CustomersTabBody, HomeTabStrip } from "@/components/home-tabs";
import { isCustomerTab, keptMountedClass } from "@/components/home-tabs-state";
import { HomeDashboard } from "@/components/home-dashboard";
import { CUSTOMER_PANEL_TABS } from "@/components/customer-info";
import { ContactHistoryCard, ContactHistoryEntryDetail } from "@/components/agent-next-gen-contact-history";
import { INITIAL_QUEUE_SUB_ITEMS, LATEST_CONTACTS_STATIC } from "@/components/agent-next-gen-interaction-dashboard";
import { QueueSubItems } from "@/components/agent-next-gen-clock-tick";
import { tabOrderPatch } from "@/settings";
import { cn } from "@/lib/utils";

/** Home: the Home tabs and the dashboard with its docked detail panel
 *  (P-EXTRACT C8, from the page). */
export function WorkspaceHome() {
  const {
    activeDeskTab, addToast, calling, contactHistoryByRange, contentByPanelKey, customerTable,
    handleRedialButtonClick, handleReopenContactHistoryEntry, handleStartCall, hasBreachedSlaAssignment, homeTabs,
    interactions, interiorPanelOpen, outboundDial, selectedContactHistoryEntry, selectedQueueId,
    setInteriorPanelOpen, setNavOpen, setSelectedContactHistoryEntry, setSelectedQueueId, showInteriorPanel,
    showPageHeader, tabApps, updateHeaderSettings,
  } = useWorkspace();
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
                                    : interactions.length > 0
                                    ? "bg-lyra-status-warning-subtle text-lyra-status-warning-strong hover:bg-lyra-status-warning-subtle hover:opacity-80"
                                    : "bg-lyra-status-success-subtle text-lyra-status-success-strong hover:bg-lyra-status-success-subtle hover:opacity-80"
                                )}
                              >
                                My Assignment Queue: {interactions.length > 0 ? interactions.length : "Empty"}
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
                          // Clicking the row that's ALREADY selected closes
                          // the panel instead of re-opening it on itself —
                          // same "click the already-selected one to toggle
                          // it off" behavior `DashboardQueue`'s own
                          // `selectedId`/`onSelect` pair documents for the
                          // queue widgets above.
                          if (entry.id === selectedContactHistoryEntry?.id) {
                            setSelectedContactHistoryEntry(null);
                            return;
                          }
                          // Deselect the OTHER two jobs this shared interior
                          // panel slot can show — only one is ever relevant
                          // at a time, same "selectedQueueId set takes
                          // priority" convention that panel's own doc
                          // comment already documents.
                          setSelectedQueueId(null);
                          setInteriorPanelOpen(false);
                          setSelectedContactHistoryEntry(entry);
                        }}
                        selectedEntryId={selectedContactHistoryEntry?.id ?? null}
                        historyByRange={contactHistoryByRange}
                        // Per explicit request ("default the phase 1
                        // contact history filter to last 72 hours") — see
                        // `ContactHistoryCard`'s own `defaultDateFilter`
                        // doc comment (agent-next-gen-contact-history.tsx)
                        // for why this tier alone passes it.
                        defaultDateFilter="last72h"
                        // `onOpenAllContacts` intentionally omitted — per
                        // explicit request ("remove all contacts button from
                        // the contact history in the home dashboard"). This
                        // card's own `headerTitleBadge` only renders its
                        // "All Contacts" button when this prop is passed
                        // (agent-next-gen-contact-history.tsx's own
                        // `onOpenAllContacts && (...)` check), so leaving it
                        // out removes the button with no changes needed to
                        // that shared component. `handleOpenAllContacts`
                        // itself (below) and the standalone "All Contacts"
                        // view it opens (`showAllContacts`, this file's own
                        // `key="all-contacts"` branch) are left in place
                        // rather than deleted, same "may come back later"
                        // treatment this dashboard's own removed "Latest
                        // Cases" section gets (its own doc comment, just
                        // above) — only this one entry point into it is
                        // gone now.
                      />
                  }
                />
                {showInteriorPanel && (
                  <InteriorPanel
                    side="right"
                    // Reuses this one docked slot for THREE different jobs
                    // — the pre-existing "Case Details" form, the queue
                    // drill-down, and (per explicit request)
                    // `selectedContactHistoryEntry`'s own Contact History
                    // row summary — rather than stacking a second right-side
                    // panel, since only one detail view is ever relevant at
                    // a time. `selectedQueueId` set takes priority over
                    // `selectedContactHistoryEntry`, which in turn takes
                    // priority over the plain `interiorPanelOpen` "Case
                    // Details" default — same priority order in the open
                    // condition, header, content, and footer below.
                    open={interiorPanelOpen || Boolean(selectedQueueId) || Boolean(selectedContactHistoryEntry)}
                    headerTitle={
                      selectedQueueId
                        ? LATEST_CONTACTS_STATIC.find((c) => c.id === selectedQueueId)?.name ?? "Queue"
                        : selectedContactHistoryEntry
                        ? selectedContactHistoryEntry.name
                        : "Case Details"
                    }
                    // "{n} Skills" for the queue drill-down (the same count
                    // as that queue widget's own Skills metric; the queue
                    // simulation only changes counts, never list lengths,
                    // so the initial list's length is the live one too and
                    // this panel doesn't re-render on its 4s beat) or,
                    // per explicit follow-up request, the routing skill name
                    // for a Contact History entry (previously the case ID —
                    // `headerTitle` above already shows the customer's real
                    // name, so this now surfaces a second, distinct fact
                    // about the contact instead).
                    headerSubhead={
                      selectedQueueId
                        ? `${(INITIAL_QUEUE_SUB_ITEMS[selectedQueueId] ?? []).length} Skills`
                        : selectedContactHistoryEntry?.skillName
                    }
                    onClose={() => {
                      setInteriorPanelOpen(false);
                      setSelectedQueueId(null);
                      setSelectedContactHistoryEntry(null);
                    }}
                    // `PanelRightClose` — same "closing a docked right-side
                    // panel" glyph as this panel's sibling instance above,
                    // instead of `ContainerHeader`'s generic default `X`.
                    // Redial/Re-open — per explicit request, these used to
                    // render here (this `InteriorPanel`'s own `footer`
                    // slot, which pins to the bottom of the panel). Per a
                    // later explicit follow-up request ("move the redial
                    // button up directly below the gray box"), this is now
                    // the `actionButton` prop on `ContactHistoryEntryDetail`
                    // below instead — see that call site's own doc comment
                    // for the exact same button JSX/handlers, just
                    // relocated so it sits immediately after the gray card
                    // regardless of panel height, instead of anchored to
                    // the panel's own bottom edge.
                  >
                    {selectedQueueId ? (
                      <div className="flex flex-col">
                        {/* Only these rows re-render on the queue
                            simulation's 4s beat ("N In Queue"). */}
                        <QueueSubItems>
                          {(queueSubItems) => (
                        <>
                        {(queueSubItems[selectedQueueId] ?? []).map((item, i) => (
                          <div
                            key={item.id}
                            className={cn(
                              "flex flex-col gap-2 px-4 py-4",
                              i > 0 && "border-t border-lyra-border-subtle"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="inline-flex items-center gap-2 lyra-body-md-emphasis text-lyra-fg-default">
                                <item.icon className="h-4 w-4 text-lyra-fg-secondary" strokeWidth={1.5} />
                                {item.label}
                              </span>
                              <span className="lyra-body-sm text-lyra-fg-secondary whitespace-nowrap">
                                {item.inQueueCount} In Queue
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 lyra-body-sm text-lyra-fg-secondary">
                              <Clock className="h-3 w-3" strokeWidth={1.5} />
                              Longest Wait Time: {item.wait}
                            </span>
                            {/* Available / Working / Unavailable agent counts for
                                this sub-queue — same icons, colors, and order as
                                PRODUCTIVITY_STATUS_META (Activity/Productivity
                                cards), just rendered as compact circular Icon
                                badges instead of a donut/bar. Each badge gets a
                                hover tooltip spelling out what the count means,
                                since the color/icon alone doesn't say "agents". */}
                            <div className="flex items-center gap-3">
                              <Tooltip content="Available Agents" placement="top">
                                <span className="inline-flex items-center gap-1.5">
                                  <Icon icon={CheckCircle2} size="sm" background="success" shape="circle" decorative />
                                  <span className="lyra-body-sm-emphasis text-lyra-fg-default">{item.available}</span>
                                </span>
                              </Tooltip>
                              <Tooltip content="Working Agents" placement="top">
                                <span className="inline-flex items-center gap-1.5">
                                  <Icon icon={CircleDot} size="sm" background="warning" shape="circle" decorative />
                                  <span className="lyra-body-sm-emphasis text-lyra-fg-default">{item.working}</span>
                                </span>
                              </Tooltip>
                              <Tooltip content="Unavailable Agents" placement="top">
                                <span className="inline-flex items-center gap-1.5">
                                  <Icon icon={MinusCircle} size="sm" background="critical" shape="circle" decorative />
                                  <span className="lyra-body-sm-emphasis text-lyra-fg-default">{item.unavailable}</span>
                                </span>
                              </Tooltip>
                            </div>
                          </div>
                        ))}
                        </>
                          )}
                        </QueueSubItems>
                      </div>
                    ) : selectedContactHistoryEntry ? (
                      <ContactHistoryEntryDetail
                        entry={selectedContactHistoryEntry}
                        // Redial/Re-open — per explicit request, these used
                        // to render in this `InteriorPanel`'s own separate
                        // `footer` slot (which pins to the bottom of the
                        // panel); per a later explicit follow-up request
                        // ("move the redial button up directly below the
                        // gray box"), passed in here instead so
                        // `ContactHistoryEntryDetail` renders it immediately
                        // after its own gray card. Mutually exclusive by
                        // channel type, per explicit request — a voice
                        // contact (`entry.redial`) only ever gets "Redial"
                        // (starting a literal fresh call is the only thing
                        // "reopening" a call can mean), never "Re-open"
                        // alongside it; every other channel type only ever
                        // gets "Re-open" (nothing to "redial" on a
                        // chat/SMS/email/WhatsApp contact).
                        //
                        // Re-open still reopens the contact as a live
                        // assignment in the left nav
                        // (`handleReopenContactHistoryEntry`'s own doc
                        // comment) and closes this panel immediately, since
                        // there's nothing left here to look at once that's
                        // happened. Redial no longer does either of those
                        // things directly — per explicit follow-up request
                        // ("add the number / skill selection popover to the
                        // click of a redial to phase 1B - same
                        // functionality as in Phase 1"),
                        // `handleRedialButtonClick` only opens the Dial Pad
                        // popover (anchored on this very button — its own
                        // `e.currentTarget`, passed through as `anchorEl`,
                        // see `dialpadRequest`'s own doc comment above) and
                        // leaves this panel open; the actual redial only
                        // happens once the agent picks a skill and submits
                        // there (`handleDialpadSubmit`/`handleRedial`).
                        // Mirrors AgentNextGenPage.tsx's own identical
                        // treatment.
                        actionButton={
                          selectedContactHistoryEntry.redial && !calling.redial ? undefined : selectedContactHistoryEntry.redial ? (
                            // Disabled with the reason while Unavailable or on a call with this customer (another call holds, row 15).
                            <DisabledReason reason={outboundDial.redialBlockedReason(selectedContactHistoryEntry)}>
                            <Button
                              variant="outline"
                              disabled={!!outboundDial.redialBlockedReason(selectedContactHistoryEntry)}
                              onClick={(e) => handleRedialButtonClick(selectedContactHistoryEntry, e.currentTarget)}
                            >
                              <PhoneOutgoing className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Redial
                            </Button>
                            </DisabledReason>
                          ) : (
                            <Button
                              onClick={() => {
                                handleReopenContactHistoryEntry(selectedContactHistoryEntry);
                                setSelectedContactHistoryEntry(null);
                              }}
                            >
                              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Takeover Assignment
                            </Button>
                          )
                        }
                      />
                    ) : (
                      <div className="flex flex-col gap-4 px-4 py-4">
                        <Input label="Subject" placeholder="Enter subject" />
                        <Input label="Priority" placeholder="Select priority" />
                        <Input label="Assignee" placeholder="Search agents" />
                        <Input label="Tags" placeholder="Add tags" />
                      </div>
                    )}
                  </InteriorPanel>
                )}
                </>
              ))}
              </div>
                </div>
  );
}
