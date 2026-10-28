// The Activity feed (P-HOME-1): what is coming at the person, nearest first.
// Offers pinned; the Activity · Parked · History view switcher (lyra
// ToggleGroup, single) picks the view, over one filter row every view shares
// (P-HOME-1m): its search, lyra's FilterChip for the kinds (the picked ones
// as removable tokens below), History's DateRangeFilterChip. Each view has a
// lyra EmptyState; History lists what completed in its range. The rules are
// activity-feed.ts; this file only lays them out.
import * as React from "react";
import { Badge, Button, Container, DateRangeFilterChip, EmptyState, FilterChip, Popover, SearchInput, Tag, ToggleGroup } from "@nicecxone/lyra-ui";
import { ChevronDown, CirclePause, History as HistoryIcon, ListChecks } from "lucide-react";
import type { AssignmentKind } from "@/domain";
import type { FeedRow, FeedView } from "@/contact-handling/home/activity-feed";
import { useActivityFeed, type ActivityFeed as ActivityFeedApi } from "@/contact-handling/home/useActivityFeed";
import { useScheduleSnapshot } from "@/provider-context";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { ActivityRow } from "./ActivityRow";
import { FeedRowActions } from "./FeedRowActions";
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
function RowActions({ row }: { row: FeedRow }) {
  const snapshot = useScheduleSnapshot();
  const target = row.target;
  const item = target.type === "schedule" ? snapshot?.items.find((i) => i.id === target.itemId) : undefined;
  return item ? <FeedRowActions item={item} /> : null;
}

/** The picked kinds below the filter row (P-HOME-1m): lyra's applied-filter tokens as in FilterChip's stories (removable
 *  `Tag`s, a "+N" for the rest, Clear), composed from lyra's exported parts — the story's own row isn't a component. */
const VISIBLE_KIND_TOKENS = 3;
function KindTokens({ api }: { api: ActivityFeedApi }) {
  const picked = api.kinds.filter((kind) => api.kindFilter.has(kind));
  if (picked.length === 0) return null;
  const remove = (kind: AssignmentKind) => api.setKinds(picked.filter((k) => k !== kind));
  const token = (kind: AssignmentKind) => (
    <Tag key={kind} shape="pill" variant="neutral" label={t(kindLabel(kind))} onRemove={() => remove(kind)} removeLabel={t("Remove {kind}", { kind: t(kindLabel(kind)) })} data-feed-token={kind} />
  );
  const rest = picked.slice(VISIBLE_KIND_TOKENS);
  return (
    <div className="flex flex-wrap items-center gap-2" data-feed-tokens="">
      {picked.slice(0, VISIBLE_KIND_TOKENS).map(token)}
      {rest.length > 0 && (
        <Popover placement="bottom" align="start" bodyPadding={false} content={<div className="flex flex-wrap gap-2 p-3">{rest.map(token)}</div>}>
          <Button variant="outline" size="sm" data-feed-tokens-more="">
            {t("+{count}", { count: rest.length })}
          </Button>
        </Popover>
      )}
      <Button variant="ghost" size="sm" onClick={() => api.setKinds([])} data-feed-tokens-clear="">
        {t("Clear")}
      </Button>
    </div>
  );
}

function FeedGroup({
  title,
  rows,
  now,
  api,
  empty,
  collapsible = false,
  heading = true,
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
}) {
  const [expanded, setExpanded] = React.useState(!collapsible);
  if (rows.length === 0 && !empty) return null;
  return (
    <section className="flex flex-col gap-1" data-feed-group={title} data-expanded={expanded}>
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
      ) : (
        <div role="list" className="flex flex-col">
          {rows.map((row) => (
            <div role="listitem" key={row.assignmentId}>
              <ActivityRow
                row={row}
                now={now}
                onOpen={() => api.open(row)}
                selected={api.isSelected(row)}
                // Only a scheduled or parked schedule item has actions (none on an open one or the others).
                action={row.target.type === "schedule" && (row.status === "scheduled" || row.status === "parked") ? <RowActions row={row} /> : undefined}
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
  const now = Date.now();
  const nothingComing = feed.showAssignments && feed.counts.needsDecision + feed.counts.assignments === 0;

  return (
    <div className="flex flex-col gap-4" data-activity-feed>
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
        {/* One filter row for every view (P-HOME-1m): the view's search first, then the kinds (lyra's FilterChip
            as-is, the same selection in every view), then History's date (lyra's DateRangeFilterChip as-is). The
            feed has no date control: it is nearest first, Later collapsed. The picked kinds are tokens below. */}
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
          {view === "history" && (
            <DateRangeFilterChip value={api.historyRange} onValueChange={api.setHistoryRange} customValue={api.historyCustom} onCustomValueChange={api.setHistoryCustom} />
          )}
          {/* P-HOME-2: one chip per connected personal source, then "+ Apps", go here. */}
        </div>
        <KindTokens api={api} />
      </div>
      <FeedGroup title={t("Today")} rows={feed.today} now={now} api={api} />
      <FeedGroup title={t("This week")} rows={feed.thisWeek} now={now} api={api} />
      <FeedGroup title={t("Later")} rows={feed.later} now={now} api={api} collapsible />
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
