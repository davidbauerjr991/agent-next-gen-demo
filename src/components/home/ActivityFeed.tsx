// The Activity feed (P-HOME-1): what is coming at the person, nearest first.
// Offers pinned; the Activity · Parked · History view switcher (lyra
// ToggleGroup, single) picks the view, over one filter row every view shares
// (P-HOME-1m): its search, lyra's FilterChip for the kinds (its trigger names
// the picks; Clear right after it), History's DateRangeFilterChip. Each view has a
// lyra EmptyState; History lists what completed in its range. The rules are
// activity-feed.ts; this file only lays them out.
import * as React from "react";
import { Badge, Button, Container, DateRangeFilterChip, EmptyState, FilterChip, SearchInput, ToggleGroup } from "@nicecxone/lyra-ui";
import { ChevronDown, CirclePause, History as HistoryIcon, List, ListChecks, Table2 } from "lucide-react";
import type { AssignmentKind } from "@/domain";
import { useSettings, type HomeActivityView } from "@/settings";
import { CONTACT_HISTORY_RANGE_OPTIONS } from "@/components/agent-next-gen-contact-history";
import type { FeedRow, FeedView } from "@/contact-handling/home/activity-feed";
import { homeIsTwoColumn, homeSideSections } from "@/contact-handling/home/home-layout";
import { useActivityFeed, type ActivityFeed as ActivityFeedApi } from "@/contact-handling/home/useActivityFeed";
import { useScheduleSnapshot } from "@/provider-context";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { ActivityRow } from "./ActivityRow";
import { FeedRowActions } from "./FeedRowActions";
import { FeedTable } from "./FeedTable";
import { HomeCardsToggle } from "./HomeTwoColumn";
import { kindLabel } from "./home-kinds";

/** A view button's label: its name, its count and, when there are any, its unread ("3 new", P-HOME-1k). */
function viewLabel(label: string, count?: number, unread = 0) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="truncate">{label}</span>
      {count !== undefined && <Badge shape="circle" variant="neutral" fill="subtle" size="sm" count={count} max={99} />}
      {unread > 0 && (
        <Badge shape="pill" color="blue" fontSize={12} data-feed-unread="">
          {t("{count} new", { count: unread })}
        </Badge>
      )}
    </span>
  );
}

/** A view's empty state (P-HOME-1m): lyra's, with the view's icon and one line. A search with no hits says so and offers
 *  Clear search. */
function FeedEmpty({
  icon: Icon,
  message,
  description,
  query,
  onClearQuery,
  view,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  message: string;
  description?: string;
  query: string;
  onClearQuery: () => void;
  view: FeedView;
}) {
  const searching = !!query.trim();
  return (
    <EmptyState
      data-feed-empty={view}
      icon={<Icon className="h-8 w-8" strokeWidth={1.5} />}
      message={searching ? t("No results for “{query}”", { query: query.trim() }) : message}
      description={
        searching ? (
          <Button variant="outline" size="sm" className="mt-1" onClick={onClearQuery} data-feed-clear-search="">
            {t("Clear search")}
          </Button>
        ) : (
          description
        )
      }
    />
  );
}

/** A view's search, first in the filter row. */
function ViewSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <SearchInput value={value} onValueChange={onChange} placeholder={placeholder} size="sm" className="min-w-[200px] max-w-xs flex-1" />;
}

/** A schedule row's hover cluster: Park (or Unpark), and Delete when the agent created it. */
function RowActions({ row, menu }: { row: FeedRow; menu?: boolean }) {
  const snapshot = useScheduleSnapshot();
  const target = row.target;
  const item = target.type === "schedule" ? snapshot?.items.find((i) => i.id === target.itemId) : undefined;
  return item ? <FeedRowActions item={item} menu={menu} /> : null;
}


/** A row's Park / Unpark / Delete: only a scheduled or parked schedule item has them (none on an open one or the
 *  others). The list's hover cluster as icons; the table's actions column as a kebab (`menu`). */
const rowActions = (row: FeedRow, menu = false): React.ReactNode =>
  row.target.type === "schedule" && (row.status === "scheduled" || row.status === "parked") ? <RowActions row={row} menu={menu} /> : undefined;
const rowMenu = (row: FeedRow) => rowActions(row, true);

function FeedGroup({
  title,
  rows,
  now,
  api,
  empty,
  collapsible = false,
  heading = true,
  table = false,
}: {
  title: string;
  rows: readonly FeedRow[];
  now: number;
  api: ActivityFeedApi;
  /** Shown in place of the rows when there are none (a view's empty state). */
  empty?: React.ReactNode;
  /** Collapsed until the agent opens it (Later, P-HOME-1m). */
  collapsible?: boolean;
  /** The group's heading; off for a view that is one list (Parked, History: the switcher names it, P-HOME-1m). */
  heading?: boolean;
  /** The rows as a table (`home.activityView`, P-HOME-1m): the same rows, preview and actions. */
  table?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(!collapsible);
  if (rows.length === 0 && !empty) return null;
  return (
    // A table fills what's left of the feed area (its own header, scrolling body and footer, P-HOME-1m).
    <section className={cn("flex flex-col gap-1", table && rows.length > 0 && "min-h-0 flex-1")} data-feed-group={title} data-expanded={expanded}>
      {heading && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {collapsible ? (
            <Button variant="ghost" size="sm" className="-ms-2 gap-1 lyra-label text-lyra-fg-secondary" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
              {t("{title} · {count}", { title, count: rows.length })}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} strokeWidth={1.5} aria-hidden="true" />
            </Button>
          ) : (
            <h3 className="lyra-label text-lyra-fg-secondary">{title}</h3>
          )}
        </div>
      )}
      {!expanded ? null : rows.length === 0 ? (
        empty
      ) : table ? (
        <FeedTable data-feed-table="" rows={rows} now={now} onOpen={api.open} isSelected={api.isSelected} actionsFor={rowMenu} />
      ) : (
        <div role="list" className="flex flex-col">
          {rows.map((row) => (
            <div role="listitem" key={row.assignmentId}>
              <ActivityRow
                row={row}
                now={now}
                onOpen={() => api.open(row)}
                selected={api.isSelected(row)}
                action={rowActions(row)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** The feed itself, for the `activity` Home section (both layouts). */
export function ActivityFeed() {
  const api = useActivityFeed();
  const { feed, view } = api;
  const [home, updateHome] = useSettings("home");
  const asTable = home.activityView === "table";
  const now = Date.now();
  const nothingComing = feed.showAssignments && feed.counts.needsDecision + feed.counts.assignments === 0;

  return (
    // Table mode fills the feed area (its parent gives it the height); the list flows in the area's own scroll.
    <div className={cn("flex flex-col gap-4", asTable && "h-full min-h-0")} data-activity-feed>
      {feed.needsDecision.length > 0 && (
        <Container variant="error-subtle" headerTitle={t("Needs a decision · {count}", { count: feed.needsDecision.length })} data-feed-group="Needs a decision">
          <div role="list" className="flex flex-col px-1 pb-2">
            {feed.needsDecision.map((row) => (
              <div role="listitem" key={row.assignmentId}>
                <ActivityRow row={row} now={now} onOpen={() => api.open(row)} selected={api.isSelected(row)} />
              </div>
            ))}
          </div>
        </Container>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* The view switcher: one view always selected. */}
          <div data-feed-views>
            <ToggleGroup
              type="single"
              ariaLabel={t("Activity view")}
              value={view}
              onValueChange={(value) => api.setView(value as FeedView)}
              items={[
                { value: "assignments", label: viewLabel(t("Activity"), feed.counts.assignments, feed.counts.unread) },
                { value: "parked", label: viewLabel(t("Parked"), feed.counts.parked) },
                { value: "history", label: viewLabel(t("History"), feed.counts.history) },
              ]}
            />
          </div>
          {/* List or table, for all three views (P-HOME-1m): one setting, `home.activityView`. */}
          {/* The right column's Cards toggle sits just after it (two columns, while the column doesn't fit). */}
          <div className="flex items-center gap-2" data-feed-display={home.activityView}>
            <ToggleGroup
              type="single"
              ariaLabel={t("Show the feed as")}
              value={home.activityView}
              onValueChange={(value) => updateHome({ activityView: value as HomeActivityView })}
              items={[
                { value: "list", ariaLabel: t("List"), label: <List className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> },
                { value: "table", ariaLabel: t("Table"), label: <Table2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> },
              ]}
            />
            {homeIsTwoColumn(home) && homeSideSections(home).length > 0 && <HomeCardsToggle />}
          </div>
        </div>
        {/* One filter row for every view (P-HOME-1m): the view's search first, then the kinds (lyra's FilterChip
            as-is, the same selection in every view), then History's date (lyra's DateRangeFilterChip as-is). The
            feed has no date control: it is nearest first, Later collapsed. The chip's own trigger names the picked
            kinds ("Filter: Meeting" +N); Clear sits right after it while any is picked. No removable tokens. */}
        <div className="flex flex-wrap items-center gap-2" data-feed-filters={view}>
          {view === "assignments" && <ViewSearch value={api.query} onChange={api.setQuery} placeholder={t("Search activity")} />}
          {view === "parked" && <ViewSearch value={api.parkedQuery} onChange={api.setParkedQuery} placeholder={t("Search parked")} />}
          {view === "history" && <ViewSearch value={api.historyQuery} onChange={api.setHistoryQuery} placeholder={t("Search contact history")} />}
          <span className="inline-flex" data-feed-kinds="">
            <FilterChip
              label={t("Filter")}
              options={api.kinds.map((kind) => ({ value: kind, label: t(kindLabel(kind)) }))}
              selectedValues={[...api.kindFilter]}
              onSelectionChange={(values) => api.setKinds(values as AssignmentKind[])}
            />
          </span>
          {api.kindFilter.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => api.setKinds([])} data-feed-kinds-clear="">
              {t("Clear")}
            </Button>
          )}
          {view === "history" && (
            <DateRangeFilterChip
              options={CONTACT_HISTORY_RANGE_OPTIONS}
              value={api.historyRange}
              onValueChange={api.setHistoryRange}
              customValue={api.historyCustom}
              onCustomValueChange={api.setHistoryCustom}
            />
          )}
          {/* P-HOME-2: one chip per connected personal source, then "+ Apps", go here. */}
        </div>
      </div>
      {asTable ? (
        // One table of the time groups' rows (a table sorts across them); Needs a decision stays above it.
        <FeedGroup title={t("Activity")} heading={false} rows={[...feed.today, ...feed.thisWeek, ...feed.later]} now={now} api={api} table />
      ) : (
        <>
          <FeedGroup title={t("Today")} rows={feed.today} now={now} api={api} />
          <FeedGroup title={t("This week")} rows={feed.thisWeek} now={now} api={api} />
          <FeedGroup title={t("Later")} rows={feed.later} now={now} api={api} collapsible />
        </>
      )}
      {nothingComing && (
        <FeedEmpty
          view="assignments"
          icon={ListChecks}
          message={api.kindFilter.size > 0 ? t("No activity matches these filters") : t("Nothing scheduled")}
          query={api.query}
          onClearQuery={() => api.setQuery("")}
        />
      )}
      {feed.showParked && (
        <FeedGroup
          title={t("Parked")}
          heading={false}
          table={asTable}
          rows={feed.parked}
          now={now}
          api={api}
          empty={
            <FeedEmpty
              view="parked"
              icon={CirclePause}
              message={t("Nothing parked")}
              description={t("Parked items wait here until you bring them back.")}
              query={api.parkedQuery}
              onClearQuery={() => api.setParkedQuery("")}
            />
          }
        />
      )}
      {feed.showHistory && (
        <FeedGroup
          title={t("History")}
          heading={false}
          table={asTable}
          rows={feed.history}
          now={now}
          api={api}
          empty={
            <FeedEmpty
              view="history"
              icon={HistoryIcon}
              message={api.kindFilter.size > 0 ? t("No history matches") : t("Nothing completed yet")}
              query={api.historyQuery}
              onClearQuery={() => api.setHistoryQuery("")}
            />
          }
        />
      )}
    </div>
  );
}
