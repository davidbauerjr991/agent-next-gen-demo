// The Customer Information panel's "Contacts" (history) tab, its session
// detail panel and the conversation view (P-EXTRACT C7).
import { useState, useMemo } from "react";
import {
  type DateRangeFilterValue,
  type DateRange,
  TableToolbar,
  DateRangeFilterChip,
  Label,
  Button,
  TabList,
  Tab,
  Accordion,
  ChatMessage,
  InteriorPanel,
} from "@nicecxone/lyra-ui";
import { ArrowUp, ArrowDown, Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import { isWithinCustomerHistoryDateRange, initialsFor } from "@/components/agent-next-gen-shared-utils";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_INFO_ACCORDION_CLASSNAME,
  CUSTOMER_HISTORY_CHANNEL_ICON,
  CUSTOMER_HISTORY_CHANNEL_COLOR_CLASS,
  CUSTOMER_HISTORY_CHANNEL_TYPE_FILTER_OPTIONS,
  CUSTOMER_HISTORY_DIRECTION_FILTER_OPTIONS,
  CUSTOMER_HISTORY_TAG_FILTER_OPTIONS,
  CUSTOMER_HISTORY_DATE_RANGE_OPTIONS,
  type CustomerHistoryChannelType,
  type CustomerHistoryDirection,
  type CustomerHistorySessionEntry,
  type CustomerHistoryConversationMessage,
} from "./customer-info-seed";

/** Small directional-icon pair (an `ArrowUp`/`ArrowDown` beside the channel
 *  icon) — no existing composed "inbound/outbound channel icon" exists
 *  anywhere in this file or lyra-ui (checked); side-by-side rather than
 *  overlaid as a corner badge (the convention `Button`'s own `badge` prop/
 *  `channelCount` pill elsewhere in this file use) since at this small size
 *  an overlaid arrow would mostly obscure the channel glyph underneath it,
 *  and the reference screenshots show both fully visible side by side. */
export function CustomerHistoryChannelIcon({
  channelType,
  direction,
}: {
  channelType: CustomerHistoryChannelType;
  direction: CustomerHistoryDirection;
}) {
  const ChannelIcon = CUSTOMER_HISTORY_CHANNEL_ICON[channelType];
  const DirectionIcon = direction === "outbound" ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn("flex items-center gap-0.5 shrink-0 pt-0.5", CUSTOMER_HISTORY_CHANNEL_COLOR_CLASS[channelType])}
      aria-hidden="true"
    >
      <DirectionIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
      <ChannelIcon className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}

/** The "Contacts" tab's own body — a toolbar (search + Channel
 *  type/Direction/Tags checklists + a date-range filter) above a list of
 *  `CustomerHistorySessionEntry` cards (see this section's own doc comment
 *  above). `selectedIndex`/`onSelectIndex` drive which one's own detail
 *  panel (`CustomerHistorySessionDetailPanel`, rendered as a sibling at the
 *  call site) is open; clicking the already-open card's own row toggles it
 *  back closed instead of just re-selecting the same one, same convention
 *  `CustomersListView`'s own `onRowClick` uses for `CustomerRowInfoPanel`.
 *
 *  Scrolls in its OWN independent box (`flex-1 min-h-0 overflow-hidden`
 *  below, with the list itself `overflow-y-auto`) — not as part of the
 *  Customer Information panel's shared `PanelContent` scroll region.
 *  Briefly changed to the latter (single shared scroll + a `sticky`
 *  toolbar) while chasing what turned out to be a real bug one level up —
 *  `SidePanel`'s own docked/pinned branch was missing an `h-full` its
 *  full-screen branch already had, so nothing above this component ever
 *  had a genuinely definite height to bound against, no matter how this
 *  component itself was built. With that fixed at its actual source (see
 *  `CustomerInformationPanelBody`'s own outer wrapper comment), the
 *  original independent-scroll design works as intended again, and is
 *  worth keeping over the shared-scroll fallback: it's what lets
 *  `CustomerHistorySessionDetailPanel` (rendered as this component's own
 *  sibling at the call site) overlay ON TOP of this list instead of
 *  pushing it down or inheriting an arbitrary, content-driven height that
 *  doesn't match the visible viewport.
 *
 *  Search/filter state is local (`useState` in here), not lifted to
 *  `AgentNextGenPage` — unlike `selectedIndex` (which has to survive this
 *  component unmounting, since the detail panel renders as its sibling),
 *  nothing outside this component ever needs to read or restore the
 *  toolbar's own state, so there's no reason to hoist it. `selectedIndex`
 *  itself always refers to a position in the full, unfiltered `entries`
 *  array (so `CustomerHistorySessionDetailPanel`'s prev/next chevrons keep
 *  stepping through the customer's whole history, not just whatever's
 *  currently visible under a filter) — the filtered rows below are mapped
 *  with their original index preserved for exactly that reason. */
export function CustomerHistoryTabContent({
  entries,
  selectedIndex,
  onSelectIndex,
}: {
  entries: CustomerHistorySessionEntry[];
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({});
  const [dateRangeValue, setDateRangeValue] = useState<DateRangeFilterValue>("last30");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);

  const filterDefs = [
    { key: "channelType", label: "Channel type", options: CUSTOMER_HISTORY_CHANNEL_TYPE_FILTER_OPTIONS },
    { key: "direction", label: "Direction", options: CUSTOMER_HISTORY_DIRECTION_FILTER_OPTIONS },
    { key: "tags", label: "Tags", options: CUSTOMER_HISTORY_TAG_FILTER_OPTIONS },
  ];
  const handleFilterChange = (key: string, values: string[]) =>
    setFilterValues((prev) => ({ ...prev, [key]: values }));
  const clearAllFilters = () => {
    setFilterValues({});
    setSearchQuery("");
    setDateRangeValue("last30");
    setCustomDateRange(undefined);
  };

  const channelTypeValues = filterValues.channelType ?? [];
  const directionValues = filterValues.direction ?? [];
  const tagValues = filterValues.tags ?? [];

  // Keeps each visible row's ORIGINAL index into `entries` (see this
  // component's own doc comment above for why that matters), rather than
  // reassigning fresh 0-based indices to the filtered subset.
  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => {
        if (query) {
          const haystack = `${entry.target} ${entry.agentName} ${entry.typeLabel}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (channelTypeValues.length && !channelTypeValues.includes(entry.channelType)) return false;
        if (directionValues.length && !directionValues.includes(entry.direction)) return false;
        if (tagValues.length && !entry.tags.some((tag) => tagValues.includes(tag))) return false;
        if (!isWithinCustomerHistoryDateRange(entry.timestamp, dateRangeValue, customDateRange)) return false;
        return true;
      });
  }, [entries, searchQuery, channelTypeValues, directionValues, tagValues, dateRangeValue, customDateRange]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
        <Inbox className="h-8 w-8 text-lyra-fg-disabled" strokeWidth={1.5} aria-hidden="true" />
        <p className="lyra-body-md text-lyra-fg-disabled text-center">No previous interactions with this customer</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <TableToolbar
        className="px-6"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterDefs={filterDefs}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onFilterClear={clearAllFilters}
        filters={
          <DateRangeFilterChip
            value={dateRangeValue}
            onValueChange={setDateRangeValue}
            options={CUSTOMER_HISTORY_DATE_RANGE_OPTIONS}
            customValue={customDateRange}
            onCustomValueChange={setCustomDateRange}
          />
        }
      />

      {filteredEntries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
          <Inbox className="h-8 w-8 text-lyra-fg-disabled" strokeWidth={1.5} aria-hidden="true" />
          <p className="lyra-body-md text-lyra-fg-disabled text-center">No interactions match these filters</p>
        </div>
      ) : (
        // `min-h-0` — without it, this flex-column item's default
        // `min-height: auto` lets it refuse to shrink below its own
        // (potentially long) list's natural content height during the
        // flex algorithm's shrink pass, so it would grow past its actual
        // available space instead of respecting it — the classic nested-
        // flex-scroll gotcha. Needed now that this list is back to
        // scrolling in its own independent box (see this component's own
        // doc comment).
        <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
          {filteredEntries.map(({ entry, index }, i) => {
            const isSelected = selectedIndex === index;
            return (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => onSelectIndex(isSelected ? null : index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectIndex(isSelected ? null : index);
                  }
                }}
                className={cn(
                  "flex items-start gap-3 px-6 py-3 cursor-pointer transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lyra-border-focus focus-visible:-ring-offset-2",
                  i > 0 && "border-t border-lyra-border-subtle",
                  isSelected
                    ? "bg-lyra-bg-active-subtle hover:bg-lyra-state-hover-active-subtle"
                    : "hover:bg-lyra-state-hover"
                )}
              >
                <CustomerHistoryChannelIcon channelType={entry.channelType} direction={entry.direction} />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  {/* Full-width now that the timestamp isn't sharing this
                      row with it anymore — was truncating badly (e.g. a
                      whole phone number down to "(456) 383-3...") in the
                      Customer Information panel's own narrower width (this
                      list used to only ever render at full page width, back
                      when "Interactions" was a separate top-level tab — see
                      `CUSTOMER_PANEL_TABS`), since the timestamp's own
                      `whitespace-nowrap` column was claiming a fixed chunk
                      of that now-scarcer horizontal space on every row. */}
                  <span className="lyra-body-md text-lyra-fg-default truncate">{entry.target}</span>
                  {/* Just the timestamp now — the call type/direction text
                      (e.g. "Outbound call", "Inbound sms", formerly inline
                      here next to it) and the trailing status column (e.g.
                      "Disconnected"/"Dialing") were both dropped per
                      explicit request. Direction is still conveyed visually
                      via `CustomerHistoryChannelIcon`'s own up/down arrow
                      (left of the target line above), so removing the
                      redundant text label doesn't lose that information. */}
                  <span className="lyra-body-sm text-lyra-fg-secondary whitespace-nowrap">
                    {entry.timestampDisplay}
                  </span>
                  <span className="lyra-body-sm-emphasis text-lyra-fg-default truncate">
                    {entry.agentName} ({entry.agentEmail.toUpperCase()})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Read-only session-detail field, `Label` stacked above its value —
 *  matches the reference screenshot's own layout (label above value, not
 *  `CustomerInformationPanelBody`'s Overview-tab "label left, value right"
 *  row), and reuses the plain `Label` atom rather than a hand-styled
 *  uppercase span (CONTRIBUTING's "don't hand-roll `text-transform`" rule —
 *  `Label`'s own built-in look is whatever this app already uses for every
 *  other field label, so this stays visually consistent with the rest of
 *  the panel even though it isn't pixel-identical to the reference). */
export function CustomerHistoryDetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <Label label={label} />
      <span className="lyra-body-md text-lyra-fg-default break-words">{value}</span>
    </div>
  );
}

export const CUSTOMER_HISTORY_DETAIL_TABS = ["Details", "Conversation"];

/** One read-only customer/agent bubble for the Conversation tab's SMS
 *  thread (`CustomerHistoryConversationContent` below) — was a hand-rolled
 *  copy of the live-transcript bubble markup (nearly identical to
 *  `ContactHistoryMessageBubble`, agent-next-gen-contact-history.tsx's own
 *  equivalent), now just a thin adapter over lyra-ui's shared `ChatMessage`
 *  — same component the real, in-progress transcript uses
 *  (`TranscriptMessageBubble`, agent-next-gen-transcript.tsx). No
 *  `onCopy`/`tagOptions` passed — both are live-editing affordances for an
 *  open conversation, and every session this panel shows is already closed
 *  history; there's nothing to tag or copy-in-progress, and `ChatMessage`'s
 *  own toolbar stays hidden entirely when those are omitted.
 *  `customerName`/`agentName` — `CustomerHistoryConversationMessage` itself
 *  carries no name field, so `CustomerHistoryConversationContent` passes
 *  both down from its own `entry` (`customerUsername`/`agentName`). */
export function CustomerHistoryConversationMessageBubble({
  message,
  customerName,
  agentName,
}: {
  message: CustomerHistoryConversationMessage;
  customerName: string;
  agentName: string;
}) {
  const isCustomer = message.sender === "customer";
  return (
    <ChatMessage
      variant={message.sender}
      name={isCustomer ? customerName : agentName}
      initials={initialsFor(isCustomer ? customerName : agentName)}
      timestamp={message.timestampDisplay}
      text={message.text}
    />
  );
}

/** The Conversation tab's actual body — what it shows depends on
 *  `entry.channelType`, since a call/SMS thread/email genuinely don't look
 *  like the same kind of content (same reasoning `InteractionTranscript`'s
 *  own per-channel branching already uses, see that component's doc
 *  comment): an SMS session renders its real reconstructed message thread
 *  (`conversationMessages`); a voice session has no messages at all, just a
 *  call-notes card (`conversationSummary`) with its `callDurationDisplay`;
 *  an email session renders as `emailSubject` + body (`conversationSummary`
 *  again) rather than chat bubbles, since an email doesn't read as a
 *  back-and-forth the way SMS does. */
export function CustomerHistoryConversationContent({ entry }: { entry: CustomerHistorySessionEntry }) {
  if (entry.channelType === "sms") {
    return (
      <div className="flex flex-col gap-4 px-4 py-3">
        {(entry.conversationMessages ?? []).map((message, i) => (
          <CustomerHistoryConversationMessageBubble
            key={i}
            message={message}
            customerName={entry.customerUsername}
            agentName={entry.agentName}
          />
        ))}
      </div>
    );
  }

  if (entry.channelType === "email") {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className={cn(CUSTOMER_INFO_ACCORDION_CLASSNAME, "flex flex-col gap-3 p-4")}>
          <CustomerHistoryDetailField label="Subject" value={entry.emailSubject ?? ""} />
          <div className="flex flex-col gap-1">
            <Label label="Body" />
            <p className="lyra-body-md text-lyra-fg-default">{entry.conversationSummary}</p>
          </div>
        </div>
      </div>
    );
  }

  // Voice — call notes + duration, no message thread.
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className={cn(CUSTOMER_INFO_ACCORDION_CLASSNAME, "flex flex-col gap-3 p-4")}>
        <CustomerHistoryDetailField label="Duration" value={entry.callDurationDisplay ?? ""} />
        <div className="flex flex-col gap-1">
          <Label label="Call Notes" />
          <p className="lyra-body-md text-lyra-fg-default">{entry.conversationSummary}</p>
        </div>
      </div>
    </div>
  );
}

/** Right-docked `InteriorPanel` opened by clicking a `CustomerHistoryTabContent`
 *  card — same "click a row, open a right `InteriorPanel`, chevron through
 *  the list" shape `CustomerRowInfoPanel` already uses for the Customers
 *  table (see that component's own doc comment), just over
 *  `CustomerHistorySessionEntry` rows instead of `CustomerListRecord` ones.
 *
 *  Two tabs, per explicit request: "Details" (a "Conversation Details" card
 *  — summary blurb + Duration for voice entries — directly above a
 *  "Session Details" card of this session's own identity fields, both
 *  collapsible `Accordion`s rather than permanently-expanded blocks; panel
 *  header itself reads "Interaction Details", was "Session Details") and
 *  "Conversation" (the actual reconstructed conversation content,
 *  `CustomerHistoryConversationContent` above). Own `activeTab` state,
 *  reset back to "Details" whenever a different session's entry is opened
 *  (via `entry?.id`) — a `Conversation` tab left open on session A
 *  shouldn't carry over silently to session B. */
export function CustomerHistorySessionDetailPanel({
  entry,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: {
  entry: CustomerHistorySessionEntry | null;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}) {
  /* Defaults to "Conversation", not "Details" — agents open a past session
     to read what was said; the metadata fields are the secondary tab.
     Deliberately NOT reset when `entry.id` changes (it used to reset to 0
     on every change): the prev/next chevrons' primary use is scanning back
     through several sessions reading each conversation, and resetting the
     tab forced a re-click of "Conversation" on every step of that scan. */
  const [activeTab, setActiveTab] = useState(() => CUSTOMER_HISTORY_DETAIL_TABS.indexOf("Conversation"));

  return (
    <InteriorPanel
      side="right"
      open={entry !== null}
      onClose={onClose}
      // `z-[3]` — overrides `InteriorPanel`'s own default `z-[5]` (via
      // `cn()`'s `tailwind-merge` dedup, same "consumer className overrides
      // the internal default" mechanism `CustomerInformationSidePanel`'s own
      // header-icon `Popover` etc. already rely on elsewhere in this file).
      // Needed because this panel's absolutely-positioned narrow/overlay
      // branch (interior-panel.tsx, triggered below ~1024px of available
      // width) and `CustomerInformationSidePanel`'s own unpinned/floating
      // branch (side-panel.tsx) both otherwise land on that exact same
      // `z-[5]` tier — and since neither of their shared ancestors (the
      // "everything else" column, this body row) sets its own `z-index`,
      // they compete in the SAME stacking context, where DOM order (this
      // panel renders later/deeper) broke the tie in this panel's favor —
      // confirmed live: opening a session's details in a narrow container
      // painted this panel over top of the Customer Information panel
      // instead of leaving it visible. `z-[3]` keeps this panel safely
      // above the plain `CustomerHistoryTabContent` list it's meant to
      // cover (unstyled, `z-auto`) while staying below the Customer
      // Information panel's own `z-[5]` — same "pick a tier relative to
      // that panel's z-[5]" convention already established for the
      // transcript's own sticky session separator (`z-[1]`, see its own
      // doc comment) and the shared panel's fullscreen overlay (`z-[9]`).
      className="z-[3]"
      storageKey="customer-history-session-detail-panel-width"
      headerTitle="Interaction Details"
      headerSubhead={entry?.timestampDisplay}
      headerActions={
        <>
          <Button
            variant="outline"
            size="icon-md"
            onClick={onPrevious}
            disabled={!hasPrevious}
            title="Previous session"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon-md" onClick={onNext} disabled={!hasNext} title="Next session">
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </>
      }
      headerTabs={
        <TabList className="px-4" overflowMenu>
          {CUSTOMER_HISTORY_DETAIL_TABS.map((label, i) => (
            <Tab key={label} active={activeTab === i} onClick={() => setActiveTab(i)}>
              {label}
            </Tab>
          ))}
        </TabList>
      }
    >
      {entry && activeTab === CUSTOMER_HISTORY_DETAIL_TABS.indexOf("Details") && (
        <div className="flex flex-col gap-4 px-4 pt-3 pb-4 lyra-form-grid-wrap">
          {/* Conversation Details — moved above Session Details (per
              explicit request; was below it). Duration added here too
              (voice entries only — `callDurationDisplay` is only ever set
              for `channelType === "voice"`, see `CustomerHistorySessionEntry`'s
              own doc comment — SMS/email entries just show the summary
              alone, same as before). */}
          <Accordion
            className={CUSTOMER_INFO_ACCORDION_CLASSNAME}
            defaultValue="conversation-details"
            items={[
              {
                id: "conversation-details",
                title: "Conversation Details",
                content: (
                  <div className="flex flex-col gap-4">
                    {entry.callDurationDisplay && (
                      <CustomerHistoryDetailField label="Duration" value={entry.callDurationDisplay} />
                    )}
                    <p className="lyra-body-md text-lyra-fg-secondary">{entry.conversationSummary}</p>
                  </div>
                ),
              },
            ]}
          />
          <Accordion
            className={CUSTOMER_INFO_ACCORDION_CLASSNAME}
            defaultValue="session-details"
            items={[
              {
                id: "session-details",
                title: "Session Details",
                content: (
                  <div className="flex flex-col gap-4">
                    <CustomerHistoryDetailField label="Start Date" value={entry.timestampDisplay} />
                    <div className="lyra-form-grid">
                      <CustomerHistoryDetailField
                        label="Agent"
                        value={`${entry.agentName} (${entry.agentEmail.toUpperCase()})`}
                      />
                      <CustomerHistoryDetailField label="Target" value={entry.target} />
                    </div>
                    <CustomerHistoryDetailField label="Type" value={entry.typeLabel} />
                    <CustomerHistoryDetailField label="Call Center" value={entry.callCenter} />
                    <CustomerHistoryDetailField label="Customer" value={entry.customerUsername} />
                    <CustomerHistoryDetailField label="External Interaction ID" value={entry.externalInteractionId} />
                    <CustomerHistoryDetailField label="External Thread ID" value={entry.externalThreadId} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
      {entry && activeTab === CUSTOMER_HISTORY_DETAIL_TABS.indexOf("Conversation") && (
        <>
          {/* One-line outcome header — status · agent · date — so quick
              "how did that end?" lookups can finish without reading the
              thread at all. Same lyra-body-sm secondary treatment as the
              Overview tab's Latest Interaction meta lines. */}
          <div className="px-4 pt-3">
            <span className="lyra-body-sm text-lyra-fg-secondary">
              {[entry.statusLabel, entry.agentName, entry.timestampDisplay].filter(Boolean).join(" · ")}
            </span>
          </div>
          <CustomerHistoryConversationContent entry={entry} />
        </>
      )}
    </InteriorPanel>
  );
}

/* ── HistoryConversationView ──
   A past session's conversation rendered in the INTERACTION SPACE (the
   record area's content column), as the body of the history tab the
   Customer Information panel's "Open Conversation" deep link opens — full
   reading width, unlike the ≤425px panel detail. Same one-line outcome
   header + `CustomerHistoryConversationContent` composition the panel's own
   detail view uses; `px-2` tops up that content's own `px-4` to the record
   area's standard 24px inset. */
export function HistoryConversationView({ entry }: { entry: CustomerHistorySessionEntry }) {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto px-2">
      <div className="px-4 pt-4">
        <span className="lyra-body-sm text-lyra-fg-secondary">
          {[entry.statusLabel, entry.agentName, entry.timestampDisplay].filter(Boolean).join(" · ")}
        </span>
      </div>
      <CustomerHistoryConversationContent entry={entry} />
    </div>
  );
}
