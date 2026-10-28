// The Activity feed (P-HOME-1): what is coming at the person, nearest first.
// A banner for assignments that arrived while the agent wasn't on them
// (P-HOME-1m), then offers pinned; the Assignments · Parked · History view
// switcher (lyra ToggleGroup, single) picks the view and the kind chips below
// it (lyra selectable Tags, multi-select) filter every view; History lists
// what completed in its range. The rules are activity-feed.ts; this file only
// lays them out.
import * as React from "react";
import { ActionIconButton, Badge, Button, Container, InlineNotification, Link, SearchInput, Tag, ToggleGroup } from "@nicecxone/lyra-ui";
import { ChevronDown } from "lucide-react";
import { timeLabel } from "@/components/ai-cards/ai-card-icon";
import { CONTACT_HISTORY_DATE_FILTER_OPTIONS } from "@/components/agent-next-gen-contact-history";
import { RadioFilterChip } from "@/components/RadioFilterChip";
import type { FeedRow, FeedView } from "@/contact-handling/home/activity-feed";
import { useAssignmentArrivals, type AssignmentArrival } from "@/contact-handling/home/useAssignmentArrivals";
import { useActivityFeed, type ActivityFeed as ActivityFeedApi } from "@/contact-handling/home/useActivityFeed";
import { useScheduleSnapshot } from "@/provider-context";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { ActivityRow } from "./ActivityRow";
import { FeedRowActions } from "./FeedRowActions";
import { KindIcon, kindLabel } from "./home-kinds";

/** One arrival's line: name · channel or kind · time. */
const arrivalLine = (a: AssignmentArrival) =>
  a.detail ? t("{name} · {detail} · {time}", { name: a.name, detail: a.detail, time: timeLabel(a.at) }) : t("{name} · {time}", { name: a.name, time: timeLabel(a.at) });

/** What landed while the agent was elsewhere (P-HOME-1m). One: its line and View. Several: the count, and a chevron
 *  that lists them, each with its own View (collapsed there's no View). Dismiss clears them all; the rows stay
 *  unread. */
function ArrivalBanner() {
  const { arrivals, view, dismiss } = useAssignmentArrivals();
  const [expanded, setExpanded] = React.useState(false);
  // A list that drops below two closes, so the next pair comes back collapsed.
  React.useEffect(() => {
    if (arrivals.length < 2) setExpanded(false);
  }, [arrivals.length]);
  const newest = arrivals[0];
  if (!newest) return null;
  if (arrivals.length === 1) {
    return (
      <InlineNotification
        variant="info"
        data-feed-arrivals={1}
        onDismiss={dismiss}
        actionPlacement="inline"
        action={<Link onClick={() => view(newest.id)}>{t("View")}</Link>}
      >
        {t("New assignment · {line}", { line: arrivalLine(newest) })}
      </InlineNotification>
    );
  }
  return (
    <InlineNotification
      variant="info"
      data-feed-arrivals={arrivals.length}
      data-expanded={expanded}
      onDismiss={dismiss}
      action={
        expanded && (
          <ul className="flex flex-col gap-1" data-feed-arrival-list="">
            {arrivals.map((a) => (
              <li key={a.id} className="flex items-center gap-2 lyra-body-md text-lyra-fg-default" data-feed-arrival={a.id}>
                <span className="min-w-0 truncate">{arrivalLine(a)}</span>
                <Link onClick={() => view(a.id)}>{t("View")}</Link>
              </li>
            ))}
          </ul>
        )
      }
    >
      <span className="inline-flex items-center gap-1">
        {t("{count} new assignments", { count: arrivals.length })}
        <ActionIconButton title={expanded ? t("Hide new assignments") : t("Show new assignments")} aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} strokeWidth={1.5} />
        </ActionIconButton>
      </span>
    </InlineNotification>
  );
}

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
  return item ? <FeedRowActions item={item} /> : null;
}

function FeedGroup({
  title,
  rows,
  now,
  api,
  empty,
  action,
  collapsible = false,
}: {
  title: string;
  rows: readonly FeedRow[];
  now: number;
  api: ActivityFeedApi;
  empty?: string;
  /** A control in the group's header (History's date range). */
  action?: React.ReactNode;
  /** Collapsed until the agent opens it (Later, P-HOME-1m). */
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(!collapsible);
  if (rows.length === 0 && !empty) return null;
  return (
    <section className="flex flex-col gap-1" data-feed-group={title} data-expanded={expanded}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {collapsible ? (
          <Button variant="ghost" size="sm" className="-ms-2 gap-1 lyra-label text-lyra-fg-secondary" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {t("{title} · {count}", { title, count: rows.length })}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        ) : (
          <h3 className="lyra-label text-lyra-fg-secondary">{title}</h3>
        )}
        {action}
      </div>
      {!expanded ? null : rows.length === 0 ? (
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
      <ArrivalBanner />
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
        {/* The kinds the persona sees, filtering every view; none picked is every kind. No date control here: the feed
            is nearest first, Later collapsed (P-HOME-1m). */}
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>
      <FeedGroup title={t("Today")} rows={feed.today} now={now} api={api} />
      <FeedGroup title={t("This week")} rows={feed.thisWeek} now={now} api={api} />
      <FeedGroup title={t("Later")} rows={feed.later} now={now} api={api} collapsible />
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
              {/* Contact History's date options; not in a container header, so no kebab (P-HOME-1m). */}
              <RadioFilterChip
                label={t("Date")}
                options={CONTACT_HISTORY_DATE_FILTER_OPTIONS}
                value={api.historyRange}
                onValueChange={api.setHistoryRange}
                collapsible={false}
              />
            </span>
          }
        />
      )}
      {nothingComing && <p className="lyra-body-sm text-lyra-fg-secondary">{t("Nothing coming up.")}</p>}
    </div>
  );
}
