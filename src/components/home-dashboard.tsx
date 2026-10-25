// The Home Dashboard (P0.5d.2): the greeting header and the sections, both
// configured on Settings → Home (v3's Home settings, ported). P-HOME-1: the
// Activity feed and the role cards are sections too, and `home.layout`
// picks one column (rows) or two (the feed left, the rest stacked right).
import * as React from "react";
import { DashboardCard, DashboardQueue, LYRA_CARD_MAX_WIDTH } from "@nicecxone/lyra-ui";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "@/components/home/ActivityFeed";
import { HomeGreetingHeader } from "@/components/home/HomeGreetingHeader";
import { MetricCard, RemindersCard } from "@/components/home/persona-cards";
import { t } from "@/i18n";
import {
  LATEST_CONTACTS_STATIC,
  buildLatestContacts,
  PerformanceBreakdownCard,
  PerformanceSummaryCard,
} from "@/components/agent-next-gen-interaction-dashboard";
import { ClockTick, QueueSubItems } from "@/components/agent-next-gen-clock-tick";
import { useSettings, type HomeQueueChannel, type HomeSectionKey } from "@/settings";
import { channelOn } from "@/contact-handling/channel-gates";

/** Which Settings → Home queue flag shows each `LATEST_CONTACTS_STATIC` tile. */
const QUEUE_CHANNEL_BY_ID: Record<string, HomeQueueChannel> = {
  "1": "digital",
  "2": "inboundVoice",
  "3": "voicemail",
  "4": "workItem",
  "5": "outboundVoice",
};

export interface HomeDashboardProps {
  /** The page's own header switch; Settings → Home "Show header" also applies. */
  showPageHeader: boolean;
  /** The header's right side (the My Assignment Queue chip). */
  headerActions: React.ReactNode;
  selectedQueueId: string | null;
  /** `null` when the selected tile is clicked again. */
  onSelectQueue: (id: string | null) => void;
  /** The Contact History card, wired by the page. */
  contactHistory: React.ReactNode;
}

/** The contact channels each queue tile carries (Settings → Channels): a tile shows while one of them is on.
 *  Work items aren't a contact channel, so that tile isn't gated. */
const QUEUE_CONTACT_CHANNELS: Record<HomeQueueChannel, readonly string[] | undefined> = {
  digital: ["chat", "email", "sms", "whatsapp"],
  inboundVoice: ["voice"],
  voicemail: ["voice"],
  outboundVoice: ["voice"],
  workItem: undefined,
};

export function HomeDashboard({ showPageHeader, headerActions, selectedQueueId, onSelectQueue, contactHistory }: HomeDashboardProps) {
  const [home] = useSettings("home");
  const [channels] = useSettings("channels");
  const queueBases = LATEST_CONTACTS_STATIC.filter((base) => {
    const queue = QUEUE_CHANNEL_BY_ID[base.id];
    const contactChannels = queue ? QUEUE_CONTACT_CHANNELS[queue] : undefined;
    return (home.queue.channels[queue] ?? true) && (!contactChannels || contactChannels.some((c) => channelOn(channels, c)));
  });
  const twoColumn = home.layout === "twoColumn";

  // One section's content, or null when it has nothing to show (no queue tiles on: no empty row).
  const nodeFor = (key: HomeSectionKey): React.ReactNode => {
    switch (key) {
      case "queue":
        if (queueBases.length === 0) return null;
        // Only the tiles re-render on the queue simulation's beat and the page clock.
        return (
          <QueueSubItems>
            {(queueSubItems) => (
              <ClockTick>
                {(clockTick) => (
                  <DashboardQueue
                    items={buildLatestContacts(queueBases, queueSubItems, clockTick).map((contact) => ({
                      id: contact.id,
                      name: contact.name,
                      icon: contact.icon,
                      wait: contact.wait,
                      skillsCount: contact.skillsCount,
                      contactsCount: contact.contactsCount,
                      agentsCount: contact.agentsCount,
                    }))}
                    selectedId={selectedQueueId}
                    onSelect={onSelectQueue}
                  />
                )}
              </ClockTick>
            )}
          </QueueSubItems>
        );
      case "contactHistory":
        return contactHistory;
      case "performance":
        return <PerformanceSummaryCard />;
      case "productivity":
        return <PerformanceBreakdownCard />;
      case "activity":
        // A container row like Contact History's; in two columns the feed is the main column itself.
        return twoColumn ? (
          <ActivityFeed />
        ) : (
          <DashboardCard variant="neutral-subtle" headerTitle={t("Activity")}>
            <ActivityFeed />
          </DashboardCard>
        );
      case "reminders":
        return <RemindersCard />;
      default:
        return <MetricCard section={key} />;
    }
  };

  // Enabled sections in the stored order.
  const visible = home.sections.filter((s) => s.enabled).map((s) => s.key);
  const header = showPageHeader && home.showHeader && (
    <div className="-mx-6 mb-6">
      <HomeGreetingHeader actions={headerActions} welcome={twoColumn} />
    </div>
  );

  // Two columns (the wireframe): the welcome header, the feed as the main
  // column, every other enabled section stacked on the right in its order.
  if (twoColumn && visible.includes("activity")) {
    const side = visible.filter((key) => key !== "activity").flatMap((key) => {
      const node = nodeFor(key);
      return node ? [<div key={key} data-home-section={key}>{node}</div>] : [];
    });
    return (
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto px-6 py-6 animate-in fade-in-0 duration-200" data-home-layout="twoColumn">
        {header}
        <div className="flex min-w-0 items-start gap-6">
          <div className="min-w-0 flex-1" data-home-section="activity">
            {nodeFor("activity")}
          </div>
          {side.length > 0 && (
            <div className="flex shrink-0 flex-col gap-6" style={{ width: LYRA_CARD_MAX_WIDTH }} data-home-column="side">
              {side}
            </div>
          )}
        </div>
      </div>
    );
  }

  // One column: rows in the stored order. Performance and Productivity next
  // to each other share one grid row (v3); every row after the first gets
  // the row gap.
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < visible.length; ) {
    const gap = rows.length === 0 ? undefined : "mt-6";
    const key = visible[i];
    if (key === "performance" || key === "productivity") {
      const run: HomeSectionKey[] = [];
      while (i < visible.length && (visible[i] === "performance" || visible[i] === "productivity")) run.push(visible[i++]);
      rows.push(
        <div key={run.join("-")} data-home-section={run.join(" ")} className={cn(gap, "lyra-container-grid")}>
          {run.map((r) => (r === "performance" ? <PerformanceSummaryCard key={r} /> : <PerformanceBreakdownCard key={r} />))}
        </div>
      );
      continue;
    }
    i++;
    const node = nodeFor(key);
    if (!node) continue;
    rows.push(
      <div key={key} data-home-section={key} className={gap}>
        {node}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-y-auto px-6 py-6 animate-in fade-in-0 duration-200" data-home-layout="oneColumn">
      <div className="w-full max-w-[1024px] mx-auto lyra-container-grid-wrap">
        {header}
        {rows}
      </div>
    </div>
  );
}
