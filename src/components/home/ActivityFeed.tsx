// The Activity feed (P-HOME-1): what is coming at the person, in time order.
// Offers pin to the top; the Assignments · Parked · History view switcher
// (lyra ToggleGroup, single) picks the view and the kind chips below it
// (lyra selectable Tags, multi-select) filter it; History lists what left the
// feed in its range. The rules are activity-feed.ts; this file only lays them out.
import * as React from "react";
import { Badge, Container, SearchInput, Tag, ToggleGroup } from "@nicecxone/lyra-ui";
import { ContactHistoryDateFilterChip } from "@/components/agent-next-gen-contact-history";
import { RadioFilterChip } from "@/components/RadioFilterChip";
import { ASSIGNMENTS_RANGES, type AssignmentsRange, type FeedRow, type FeedView } from "@/contact-handling/home/activity-feed";
import { useActivityFeed, type ActivityFeed as ActivityFeedApi } from "@/contact-handling/home/useActivityFeed";
import { useScheduleSnapshot } from "@/provider-context";
import { t } from "@/i18n";
import { ActivityRow } from "./ActivityRow";
import { FeedRowActions } from "./FeedRowActions";
import { KindIcon, kindLabel } from "./home-kinds";

const RANGE_LABELS: Record<AssignmentsRange, string> = {
  today: "Today",
  week: "This week",
  next30: "Next 30 days",
  all: "All",
};

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

/** A schedule row's hover cluster: Park (or Unpark), and Delete when the agent created it. */
function RowActions({ row }: { row: FeedRow }) {
  const snapshot = useScheduleSnapshot();
  const target = row.target;
  const item = target.type === "schedule" ? snapshot?.items.find((i) => i.id === target.itemId) : undefined;
  return item ? <FeedRowActions item={item} form="icon" /> : null;
}

function FeedGroup({
  title,
  rows,
  now,
  api,
  empty,
  action,
}: {
  title: string;
  rows: readonly FeedRow[];
  now: number;
  api: ActivityFeedApi;
  empty?: string;
  /** A control in the group's header (History's date range). */
  action?: React.ReactNode;
}) {
  if (rows.length === 0 && !empty) return null;
  return (
    <section className="flex flex-col gap-1" data-feed-group={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="lyra-label text-lyra-fg-secondary">{title}</h3>
        {action}
      </div>
      {rows.length === 0 ? (
        <p className="lyra-body-sm text-lyra-fg-secondary">{empty}</p>
      ) : (
        <div role="list" className="flex flex-col">
          {rows.map((row) => (
            <div role="listitem" key={row.assignmentId}>
              <ActivityRow
                row={row}
                now={now}
                onOpen={() => api.open(row)}
                selected={api.isSelected(row)}
                // Only a scheduled or parked schedule item has actions (no empty cluster on the others).
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
              { value: "assignments", label: viewLabel(t("Assignments"), feed.counts.assignments, feed.counts.unread) },
              { value: "parked", label: viewLabel(t("Parked"), feed.counts.parked) },
              { value: "history", label: viewLabel(t("History"), feed.counts.history) },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* The kinds the persona sees, filtering whichever view is selected; none picked is every kind. */}
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("Filter by kind")} data-feed-kinds>
            {api.kinds.map((kind) => (
              <Tag
                key={kind}
                shape="pill"
                variant="neutral"
                icon={<KindIcon kind={kind} />}
                label={t(kindLabel(kind))}
                // Its unread rows (P-HOME-1k), whatever the other chips pick.
                {...(feed.unreadByKind[kind] ? { count: feed.unreadByKind[kind] } : {})}
                selected={api.kindFilter.has(kind)}
                onClick={() => api.toggleKind(kind)}
              />
            ))}
            {/* P-HOME-2: one chip per connected personal source, then "+ Apps", go here. */}
          </div>
          {/* The Assignments range: it bounds Today and This week, and adds Later past the week. */}
          {feed.showAssignments && (
            <span data-feed-range>
              <RadioFilterChip
                label={t("Date")}
                options={ASSIGNMENTS_RANGES.map((value) => ({ value, label: t(RANGE_LABELS[value]) }))}
                value={api.range}
                onValueChange={api.setRange}
              />
            </span>
          )}
        </div>
      </div>
      <FeedGroup title={t("Now")} rows={feed.now} now={now} api={api} />
      <FeedGroup title={t("Today")} rows={feed.today} now={now} api={api} />
      <FeedGroup title={t("This week")} rows={feed.thisWeek} now={now} api={api} />
      <FeedGroup title={t("Later")} rows={feed.later} now={now} api={api} />
      {feed.showParked && <FeedGroup title={t("Parked")} rows={feed.parked} now={now} api={api} empty={t("Nothing parked")} />}
      {feed.showHistory && (
        <FeedGroup
          title={t("History")}
          rows={feed.history}
          now={now}
          api={api}
          empty={api.historyQuery.trim() ? t("No matching contacts") : t("Nothing in this range")}
          // Contact History's own controls: its search and its date range (it has no sort).
          action={
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2" data-feed-history-controls>
              <SearchInput
                value={api.historyQuery}
                onValueChange={api.setHistoryQuery}
                placeholder={t("Search contact history")}
                size="sm"
                className="min-w-[200px] max-w-xs flex-1"
              />
              <ContactHistoryDateFilterChip defaultValue={api.historyRange} onValueChange={api.setHistoryRange} />
            </span>
          }
        />
      )}
      {nothingComing && <p className="lyra-body-sm text-lyra-fg-secondary">{t("Nothing coming up.")}</p>}
    </div>
  );
}
