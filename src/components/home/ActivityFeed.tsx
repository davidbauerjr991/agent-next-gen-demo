// The Activity feed (P-HOME-1): what is coming at the person, in time order.
// Offers pin to the top; the chips (All · Assignments · History, multi-select)
// filter; History lists what left the feed today. The rules are
// activity-feed.ts; this file only lays them out.
import * as React from "react";
import { Badge, Container, ToggleGroup, type ToggleGroupItem } from "@nicecxone/lyra-ui";
import type { FeedFilter, FeedRow } from "@/contact-handling/home/activity-feed";
import { useActivityFeed, type ActivityFeed as ActivityFeedApi } from "@/contact-handling/home/useActivityFeed";
import { t } from "@/i18n";
import { ActivityRow } from "./ActivityRow";
import { CallBackButton } from "./CallBackButton";

const ALL = "all";

function chipLabel(label: string, count?: number) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="truncate">{label}</span>
      {count !== undefined && <Badge shape="circle" variant="neutral" fill="subtle" size="sm" count={count} max={99} />}
    </span>
  );
}

function FeedGroup({
  title,
  rows,
  now,
  api,
  empty,
  rowAction,
}: {
  title: string;
  rows: readonly FeedRow[];
  now: number;
  api: ActivityFeedApi;
  empty?: string;
  rowAction?: (row: FeedRow) => React.ReactNode;
}) {
  if (rows.length === 0 && !empty) return null;
  return (
    <section className="flex flex-col gap-1" data-feed-group={title}>
      <h3 className="lyra-label text-lyra-fg-secondary">{title}</h3>
      {rows.length === 0 ? (
        <p className="lyra-body-sm text-lyra-fg-secondary">{empty}</p>
      ) : (
        <div role="list" className="flex flex-col">
          {rows.map((row) => (
            <div role="listitem" key={row.assignmentId}>
              <ActivityRow row={row} now={now} onOpen={() => api.open(row)} action={rowAction?.(row)} />
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
  const { feed, filters } = api;
  const now = Date.now();
  // A completed call in History can be called back (the Phase 2 side panel's Redial, folded into the row).
  const callBack = (row: FeedRow) => {
    const entry = api.historyEntryOf(row);
    return entry ? <CallBackButton entry={entry} /> : null;
  };

  const chips: ToggleGroupItem[] = [
    { value: ALL, label: chipLabel(t("All")) },
    { value: "assignments", label: chipLabel(t("Assignments"), feed.counts.assignments) },
    { value: "history", label: chipLabel(t("History"), feed.counts.history) },
    // P-HOME-2: one chip per connected personal source, then "+ Apps", go here.
  ];
  const onValuesChange = (values: string[]) => {
    const added = values.find((v) => v !== ALL && !filters.has(v as FeedFilter));
    const removed = [...filters].find((f) => !values.includes(f));
    if (values.includes(ALL) && filters.size > 0) api.clearFilters();
    else if (added) api.toggleFilter(added as FeedFilter);
    else if (removed) api.toggleFilter(removed);
  };

  const nothingComing =
    feed.showAssignments && !feed.showHistory && feed.counts.needsDecision + feed.counts.assignments === 0;

  return (
    <div className="flex flex-col gap-4" data-activity-feed>
      {feed.needsDecision.length > 0 && (
        <Container
          variant="error-subtle"
          headerTitle={t("Needs a decision · {count}", { count: feed.needsDecision.length })}
          data-feed-group="Needs a decision"
        >
          <div role="list" className="flex flex-col">
            {feed.needsDecision.map((row) => (
              <div role="listitem" key={row.assignmentId}>
                <ActivityRow row={row} now={now} onOpen={() => api.open(row)} />
              </div>
            ))}
          </div>
        </Container>
      )}
      <ToggleGroup
        type="multiple"
        ariaLabel={t("Filter the activity feed")}
        items={chips}
        values={filters.size === 0 ? [ALL] : [...filters]}
        onValuesChange={onValuesChange}
      />
      <FeedGroup title={t("Now")} rows={feed.now} now={now} api={api} />
      <FeedGroup title={t("Today")} rows={feed.today} now={now} api={api} />
      <FeedGroup title={t("This week")} rows={feed.thisWeek} now={now} api={api} />
      {feed.showHistory && (
        <FeedGroup
          title={t("History · left the feed today")}
          rows={feed.history}
          now={now}
          api={api}
          empty={t("Nothing yet today")}
          rowAction={callBack}
        />
      )}
      {nothingComing && <p className="lyra-body-sm text-lyra-fg-secondary">{t("Nothing coming up.")}</p>}
    </div>
  );
}
