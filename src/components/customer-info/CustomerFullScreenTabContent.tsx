import { useState, useMemo } from "react";
import {
  TabList,
  Tab,
  ActionIconButton,
  PanelHeader,
  PanelContent,
  PanelFooter,
  type CreateNewOutboundContact,
  type ChannelType,
  type MenuEntry,
  KebabMenuButton,
  type ToastItem,
} from "@nicecxone/lyra-ui";
import { RefreshCw, Trash2, MoreVertical, X, Paperclip } from "lucide-react";
import { type CustomerListRecord } from "@/components/agent-next-gen-customers-table";
import {
  CUSTOMER_PANEL_TABS,
  buildCustomerInfoFields,
  buildLatestInteraction,
  buildLatestNote,
  buildCopilotSummary,
  type CustomerPanelTabLabel,
} from "./customer-info-seed";
import { CustomerRecordSaveFooter, useCustomerRecordDraft } from "./CustomerDetailTabs";
import { CustomerInformationPanelBody } from "./CustomerInformationPanelBody";

/* ── CustomerFullScreenTabContent ──
   Per explicit request ("in agent workspace 2.0 premium, when an agent
   clicks the Full Screen [button on `CustomerRowInfoPanel`], instead of
   toggling to a full screen mode, open a new tab... put it to the far right
   of the tabs in the home screen container"): the content of one such
   desk-level tab — a customer's full profile (Overview/Detail/Notes/etc.,
   the exact same `CustomerInformationPanelBody` every other consumer of
   this file renders), stretched across the full desk-tab content column
   instead of docked/floating beside the Customers table.

   Deliberately NOT built by reusing `CustomerRowInfoPanel` (above) with
   `InteriorPanel`'s own `isFullScreen` state forced permanently on:
   `isFullScreen` is genuinely internal/uncontrolled state inside
   `InteriorPanel` (no prop exists to force it on from outside — see that
   component's own doc comment on `allowFullScreen`), and `InteriorPanel`
   itself is fundamentally a FLYOUT (open/close slide animation, drag-resize
   handle, docked-vs-overlay positioning) — repurposing it to sit
   permanently inline as an ordinary block would mean fighting all of that
   machinery rather than using it. Instead, this composes the same lower-
   level pieces `InteriorPanel` itself is built from — `PanelHeader` (=
   `ContainerHeader`), `PanelContent`, `PanelFooter` — directly, exactly the
   same way `CustomerRowInfoPanel` and `CustomerInformationSidePanel` both
   already do internally (see interior-panel.tsx / side-panel.tsx) — so this
   renders pixel-identical chrome (title/subhead row, tab strip, scrollable
   body, Save/Cancel footer) with none of the flyout-only behavior this
   context doesn't need.

   Owns its own `activeTab`/`recordDraft`/`overviewEditing` state (same
   shape `CustomerRowInfoPanel` keeps for its own instance) rather than
   sharing state with whichever `CustomerRowInfoPanel` row might currently
   be open on the Customers tab — the two are genuinely independent views
   once this tab exists (the docked panel can be closed, or moved to a
   different row, without disturbing this tab's own content), matching how
   the caller keeps every open customer tab mounted independently (see
   `openCustomerTabs`'s own doc comment, AgentWorkspace2WithDeskPage.tsx).

   No `onClose`/header X button — closing happens via the desk tab's own
   trailing remove control (the same `Tab` `onRemove` affordance every other
   removable tab in this app already uses), not a second close control
   duplicated inside the content itself. No prev/next chevrons either
   (`CustomerRowInfoPanel`'s own, for stepping through the Customers
   table's current sort order) — those are specific to that docked-panel
   workflow; this tab is anchored to one specific customer, not a walkable
   position in a list. */
export function CustomerFullScreenTabContent({
  row,
  tabs,
  onStartInteraction,
  onAddToast,
  onClose,
}: {
  row: CustomerListRecord;
  /** Same `tabs` concept every other consumer in this file takes — see
   *  `CustomerRowInfoPanel`'s own doc comment on its matching param. */
  tabs: readonly CustomerPanelTabLabel[];
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  /**
   * Per explicit request ("keep the 'x' button in the top right of the
   * record so agents can close it there or in the tab if they want") —
   * this tab already has its own close control on the `Tab` itself
   * (`removeIcon`/`onRemove`, the record-header `TabList` call site), but
   * that's easy to miss once a customer's full-screen tab is the ACTIVE
   * one and the agent is looking at this content, not the tab strip above
   * it. Mirrors the closable pattern every other panel header in this
   * file already has (`CustomerInformationSidePanel`'s `onClose`,
   * `CustomerRowInfoPanel`'s `onClose`) — same "there's more than one
   * reasonable place to close this from" precedent, just newly extended
   * to this tab-content variant. Optional/undefined renders no close
   * button at all (not every future consumer of this component need be
   * closable this way).
   */
  onClose?: () => void;
}) {
  const [activeTab, setActiveTab] = useState(() => CUSTOMER_PANEL_TABS.indexOf("Overview"));
  // Same unconditional "Copilot" strip as `CustomerRowInfoPanel` — see that
  // component's own doc comment on its matching `visibleTabs`: a customer
  // profile view (real interaction or not) never has anything for Copilot
  // to summarize here.
  const visibleTabs = tabs.filter((t) => t !== "Copilot");

  const customerName = `${row.firstName} ${row.lastName}`;
  const recordId = row.contactNumber;
  const fields = useMemo(() => buildCustomerInfoFields(customerName, recordId, []), [customerName, recordId]);
  const latestInteraction = useMemo(() => buildLatestInteraction(customerName, recordId), [customerName, recordId]);
  const latestNote = useMemo(() => buildLatestNote(customerName, recordId), [customerName, recordId]);
  const copilotSummary = useMemo(() => buildCopilotSummary(customerName, recordId), [customerName, recordId]);
  const recordDraft = useCustomerRecordDraft(fields, customerName, recordId);
  const [overviewEditing, setOverviewEditing] = useState(false);

  const recordActionItems: MenuEntry[] = [
    { id: "refresh", label: "Refresh Record", icon: <RefreshCw className="h-4 w-4" strokeWidth={1.5} /> },
    { id: "delete", label: "Delete Record", icon: <Trash2 className="h-4 w-4" strokeWidth={1.5} />, destructive: true },
  ];

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
      <PanelHeader
        title={customerName}
        subhead={recordId}
        actions={
          <>
            {/* Add Channel moved out of this header — per explicit follow-up
                request ("move the contact icon buttons into the customer
                overview and put them next to the edit button in a row above
                the other information"), it now lives inside the Customer
                Overview accordion's own top row instead (see
                `CustomerInformationPanelBody`'s `row`/`onStartInteraction`
                props, wired below at this component's own body call site). */}
            <KebabMenuButton
              items={recordActionItems}
              ariaLabel="Record actions"
              className="h-8 w-8"
              icon={<MoreVertical className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            />
            {onClose && (
              <ActionIconButton aria-label={`Close ${customerName}`} title={`Close ${customerName}`} onClick={onClose}>
                <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </ActionIconButton>
            )}
          </>
        }
        tabs={
          <TabList className="px-4" overflowMenu>
            {visibleTabs.map((label) => (
              <Tab
                key={label}
                active={activeTab === CUSTOMER_PANEL_TABS.indexOf(label)}
                onClick={() => setActiveTab(CUSTOMER_PANEL_TABS.indexOf(label))}
              >
                {label}
              </Tab>
            ))}
          </TabList>
        }
      />
      <PanelContent>
        <CustomerInformationPanelBody
          activeTab={activeTab}
          customerName={customerName}
          latestInteraction={latestInteraction}
          latestNote={latestNote}
          copilotSummary={copilotSummary}
          recordId={recordId}
          channels={[]}
          onViewAllInteractions={
            visibleTabs.includes("Contacts")
              ? () => setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Contacts"))
              : undefined
          }
          draft={recordDraft.draft}
          onDraftChange={recordDraft.updateDraft}
          onPhoneChange={recordDraft.updatePhone}
          onOverviewFieldChange={recordDraft.updateOverviewField}
          overviewEditing={overviewEditing}
          onOverviewEditingChange={setOverviewEditing}
          allowOverviewEdit
          // Feeds the Customer Overview accordion's own new top row of
          // channel-launch buttons — see `CustomerInformationPanelBody`'s
          // `row`/`onStartInteraction` doc comments, and this component's
          // own `actions` above (where `CustomerAddChannelButton` used to
          // render before this follow-up request moved it here).
          row={row}
          onStartInteraction={onStartInteraction}
        />
      </PanelContent>
      {(recordDraft.isDirty || overviewEditing) && (
        <PanelFooter>
          <CustomerRecordSaveFooter
            onSave={() => {
              recordDraft.save();
              setOverviewEditing(false);
              onAddToast?.({
                variant: "success",
                title: "Success",
                message: `${row.firstName} ${row.lastName} customer record saved`,
                duration: 4000,
              });
            }}
            onCancel={() => {
              recordDraft.cancel();
              setOverviewEditing(false);
            }}
          />
        </PanelFooter>
      )}
    </div>
  );
}

/** Full artifacts list shown in the docked Contact Details panel after "View All". */
export function ArtifactsListBody({
  artifacts,
  onOpenArtifact,
}: {
  artifacts: readonly { id: string; label: string }[];
  onOpenArtifact: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-lyra-border-subtle px-4">
      {artifacts.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => onOpenArtifact(a.id)}
            className="flex w-full items-center gap-2 py-3 text-left hover:bg-lyra-state-hover"
          >
            <Paperclip className="h-4 w-4 shrink-0 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate lyra-body-md text-lyra-fg-link">{a.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
