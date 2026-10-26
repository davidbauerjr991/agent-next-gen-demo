// The Activity feed (P-HOME-1): what is coming at the person, in time order.
// Offers pin to the top; a row of kind chips and the All · Assignments ·
// History chips (lyra selectable Tags, multi-select) filter; History lists
// what left the feed in its range. The rules are activity-feed.ts; this file
// only lays them out.
import * as React from "react";
import { Container, Tag } from "@nicecxone/lyra-ui";
import { ContactHistoryDateFilterChip } from "@/components/agent-next-gen-contact-history";
import type { FeedRow } from "@/contact-handling/home/activity-feed";
import { useActivityFeed, type ActivityFeed as ActivityFeedApi } from "@/contact-handling/home/useActivityFeed";
import { t } from "@/i18n";
import { ActivityRow } from "./ActivityRow";
import { KindIcon, kindLabel } from "./home-kinds";

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
      <div className="flex items-center justify-between gap-2">
        <h3 className="lyra-label text-lyra-fg-secondary">{title}</h3>
        {action}
      </div>
      {rows.length === 0 ? (
        <p className="lyra-body-sm text-lyra-fg-secondary">{empty}</p>
      ) : (
        <div role="list" className="flex flex-col">
          {rows.map((row) => (
            <div role="listitem" key={row.assignmentId}>
              <ActivityRow row={row} now={now} onOpen={() => api.open(row)} />
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
  const nothingComing = feed.showAssignments && !feed.showHistory && feed.counts.needsDecision + feed.counts.assignments === 0;

  return (
    <div className="flex flex-col gap-4" data-activity-feed>
      {feed.needsDecision.length > 0 && (
        <Container variant="error-subtle" headerTitle={t("Needs a decision · {count}", { count: feed.needsDecision.length })} data-feed-group="Needs a decision">
          <div role="list" className="flex flex-col px-1 pb-2">
            {feed.needsDecision.map((row) => (
              <div role="listitem" key={row.assignmentId}>
                <ActivityRow row={row} now={now} onOpen={() => api.open(row)} />
              </div>
            ))}
          </div>
        </Container>
      )}
      <div className="flex flex-col gap-2">
        {/* The kinds the persona sees; none picked is every kind. */}
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("Filter by kind")} data-feed-kinds>
          {api.kinds.map((kind) => (
            <Tag
              key={kind}
              shape="pill"
              variant="neutral"
              icon={<KindIcon kind={kind} />}
              label={t(kindLabel(kind))}
              selected={api.kindFilter.has(kind)}
              onClick={() => api.toggleKind(kind)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("Filter the activity feed")} data-feed-chips>
          <Tag shape="pill" variant="neutral" label={t("All")} selected={filters.size === 0} onClick={api.clearFilters} />
          <Tag
            shape="pill"
            variant="neutral"
            label={t("Assignments")}
            count={feed.counts.assignments}
            selected={filters.has("assignments")}
            onClick={() => api.toggleFilter("assignments")}
          />
          <Tag
            shape="pill"
            variant="neutral"
            label={t("History")}
            count={feed.counts.history}
            selected={filters.has("history")}
            onClick={() => api.toggleFilter("history")}
          />
          {/* P-HOME-2: one chip per connected personal source, then "+ Apps", go here. */}
        </div>
      </div>
      <FeedGroup title={t("Now")} rows={feed.now} now={now} api={api} />
      <FeedGroup title={t("Today")} rows={feed.today} now={now} api={api} />
      <FeedGroup title={t("This week")} rows={feed.thisWeek} now={now} api={api} />
      {feed.showHistory && (
        <FeedGroup
          title={t("History")}
          rows={feed.history}
          now={now}
          api={api}
          empty={t("Nothing in this range")}
          action={<ContactHistoryDateFilterChip defaultValue={api.historyRange} onValueChange={api.setHistoryRange} />}
        />
      )}
      {nothingComing && <p className="lyra-body-sm text-lyra-fg-secondary">{t("Nothing coming up.")}</p>}
    </div>
  );
}
