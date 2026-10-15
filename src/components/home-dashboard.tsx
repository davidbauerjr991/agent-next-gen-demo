// The Home Dashboard (P0.5d.2): the greeting header and the sections, both
// configured on Settings → Home (v3's Home settings, ported).
import * as React from "react";
import { DashboardQueue, PageHeader } from "@nicecxone/lyra-ui";
import { cn } from "@/lib/utils";
import { CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_ID } from "@/components/agent-next-gen-shared-utils";
import {
  LATEST_CONTACTS_STATIC,
  buildLatestContacts,
  PerformanceBreakdownCard,
  PerformanceSummaryCard,
} from "@/components/agent-next-gen-interaction-dashboard";
import { ClockTick, QueueSubItems } from "@/components/agent-next-gen-clock-tick";
import { useSettings, type HomeQueueChannel, type HomeSectionKey } from "@/settings";

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

export function HomeDashboard({ showPageHeader, headerActions, selectedQueueId, onSelectQueue, contactHistory }: HomeDashboardProps) {
  const [home] = useSettings("home");
  const queueBases = LATEST_CONTACTS_STATIC.filter((base) => home.queue.channels[QUEUE_CHANNEL_BY_ID[base.id]] ?? true);
  const title = `${home.greeting.trim() || "Hello"}${home.showFirstName ? ` ${CURRENT_AGENT_FIRST_NAME}` : ""}`;

  // Enabled sections in the stored order. Performance and Productivity next
  // to each other share one grid row (v3); every row after the first gets
  // the row gap.
  const visible = home.sections.filter((s) => s.enabled).map((s) => s.key);
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
    if (key === "queue") {
      // No tiles on: no empty row.
      if (queueBases.length === 0) continue;
      rows.push(
        <div key="queue" data-home-section="queue" className={gap}>
          {/* Only the tiles re-render on the queue simulation's beat and the
              page clock. */}
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
        </div>
      );
    } else {
      rows.push(
        <div key="contactHistory" data-home-section="contactHistory" className={gap}>
          {contactHistory}
        </div>
      );
    }
  }

  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-y-auto px-6 py-6 animate-in fade-in-0 duration-200">
      <div className="w-full max-w-[1024px] mx-auto lyra-container-grid-wrap">
        {showPageHeader && home.showHeader && (
          <div className="-mx-6 mb-6">
            <PageHeader
              title={title}
              subtitle={`User Name: ${CURRENT_AGENT_ID}`}
              bordered={false}
              titleSize="2xl"
              actions={headerActions}
            />
          </div>
        )}
        {rows}
      </div>
    </div>
  );
}
