import { Button, InteriorPanel, PageHeader, Tab, TabList } from "@nicecxone/lyra-ui";
import { PhoneOutgoing, RotateCcw } from "lucide-react";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { ContactHistoryEntryDetail } from "@/components/agent-next-gen-contact-history";
import { InteractionsListView, buildContactHistoryEntryFromInteractionRecord } from "@/components/agent-next-gen-interactions-table";

/** All Contacts, the standalone view (P-EXTRACT C8, from the page). */
export function AllContactsView() {
  const {
    ALL_CONTACTS_TABS, addToast, allContactsTab, handleOpenInteractionRow, selectedAllContactsRecord,
    setAllContactsTab, setSelectedAllContactsRecord, setShowAllContacts, showInteriorPanel, showPageHeader,
  } = useWorkspace();
  return (
                <div key="all-contacts" className="flex flex-1 flex-col min-w-0 overflow-hidden animate-in fade-in-0 duration-200">
                  {showPageHeader && (
                    <PageHeader
                      title="All Contacts"
                      breadcrumb={{
                        label: "Dashboard",
                        onClick: () => {
                          setShowAllContacts(false);
                          setSelectedAllContactsRecord(null);
                        },
                      }}
                    />
                  )}
                  {/* Per explicit follow-up request ("below the dashboard /
                      all contacts page header at tabs for Contacts
                      (Active), Messages and Threads") — see
                      `allContactsTab`'s own doc comment above for why only
                      "Contacts" has real content so far. */}
                  <TabList className="px-4" overflowMenu>
                    {ALL_CONTACTS_TABS.map((label) => (
                      <Tab
                        key={label}
                        active={allContactsTab === label}
                        onClick={() => setAllContactsTab(label)}
                      >
                        {label}
                      </Tab>
                    ))}
                  </TabList>
                  {allContactsTab !== "Contacts" ? (
                    // Placeholder — see `allContactsTab`'s own doc comment.
                    <div className="flex-1 overflow-y-auto" />
                  ) : (
                  /* Body row: table + this view's OWN right-docked
                      `InteriorPanel` — a second, independent instance from
                      the dashboard's own (further below), since this whole
                      view is now a standalone container with nothing else
                      to share that docked slot with. Per explicit follow-up
                      request ("when one of the rows is clicked, open an
                      interior panel like the ones in My Contact History"),
                      a row click here no longer jumps straight into a live
                      assignment (`handleOpenInteractionRow`, still what
                      this panel's own footer button calls) — it opens this
                      summary first, same "Duration"/notes box + synthesized
                      Conversation section `ContactHistoryEntryDetail`
                      already renders for a My Contact History row (see
                      `selectedContactHistoryEntry`'s own doc comment further
                      up, and `buildContactHistoryEntryFromInteractionRecord`,
                      agent-next-gen-interactions-table.tsx, for how a table
                      row is adapted into that same shape). */
                  <div className="relative flex flex-1 min-h-0 overflow-hidden">
                    <InteractionsListView
                      onAddToast={addToast}
                      // Per explicit follow-up request ("when the contact
                      // row is selected show it as active and allow it to
                      // close the panel on toggle") — clicking the row
                      // that's ALREADY selected now closes the panel
                      // instead of just reopening the same one; clicking
                      // any other row still swaps to it as before.
                      // `activeRecordId` (below) is what makes that row
                      // render as active in the table itself — see its own
                      // doc comment (agent-next-gen-interactions-table.tsx).
                      onOpenInteraction={(record) =>
                        setSelectedAllContactsRecord((prev) => (prev?.id === record.id ? null : record))
                      }
                      activeRecordId={selectedAllContactsRecord?.id ?? null}
                    />
                    {showInteriorPanel && (
                      <InteriorPanel
                        side="right"
                        open={Boolean(selectedAllContactsRecord)}
                        headerTitle={selectedAllContactsRecord?.customerName}
                        headerSubhead={selectedAllContactsRecord?.skill}
                        onClose={() => setSelectedAllContactsRecord(null)}
                        // Per explicit follow-up request ("update the
                        // toggle close icon for interior panels to be an
                        // 'x' icon") — reverts the `PanelRightClose`
                        // override an earlier request introduced here,
                        // back to `ContainerHeader`'s own generic default
                        // `X` (simply omitting `closeIcon` entirely now
                        // gets that default). Applies everywhere this
                        // pattern was used, not just Phase 1 — see the
                        // other 5 identical reverts (this file's own
                        // second `InteriorPanel`, `AgentWorkspace2WithDesk
                        // Page.tsx`'s two, `agent-next-gen-customer-info-
                        // panel.tsx`'s two, `agent-next-gen-in-contact-
                        // panel.tsx`'s one).
                        // Same mutually-exclusive Redial/Re-open convention
                        // `selectedContactHistoryEntry`'s own footer already
                        // uses (voice-only gets "Redial") — both just call
                        // `handleOpenInteractionRow`, the one handler this
                        // table's rows have always used to actually open a
                        // live assignment, then close this summary panel.
                        footer={
                          selectedAllContactsRecord ? (
                            selectedAllContactsRecord.type === "voice" ? (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  handleOpenInteractionRow(selectedAllContactsRecord);
                                  setSelectedAllContactsRecord(null);
                                }}
                              >
                                <PhoneOutgoing className="h-3.5 w-3.5" strokeWidth={1.5} />
                                Redial
                              </Button>
                            ) : (
                              <Button
                                onClick={() => {
                                  handleOpenInteractionRow(selectedAllContactsRecord);
                                  setSelectedAllContactsRecord(null);
                                }}
                              >
                                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                                Takeover Assignment
                              </Button>
                            )
                          ) : undefined
                        }
                      >
                        {selectedAllContactsRecord && (
                          <ContactHistoryEntryDetail
                            entry={buildContactHistoryEntryFromInteractionRecord(selectedAllContactsRecord)}
                          />
                        )}
                      </InteriorPanel>
                    )}
                  </div>
                  )}
                </div>
  );
}
