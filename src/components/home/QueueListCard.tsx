// The queue as one compact card for two-column Home (P-HOME-1c): a selectable
// row per queue (name, waiting, longest wait, agents) that opens the same
// skills drill-down the one-column tiles open. One column keeps the tiles.
import { DashboardCard, MenuItem } from "@nicecxone/lyra-ui";
import { buildLatestContacts, type LATEST_CONTACTS_STATIC } from "@/components/agent-next-gen-interaction-dashboard";
import { ClockTick, QueueSubItems } from "@/components/agent-next-gen-clock-tick";
import { t } from "@/i18n";

export function QueueListCard({
  bases,
  selectedId,
  onSelect,
}: {
  bases: typeof LATEST_CONTACTS_STATIC;
  selectedId: string | null;
  /** `null` when the selected row is clicked again. */
  onSelect: (id: string | null) => void;
}) {
  return (
    <DashboardCard variant="neutral-subtle" headerTitle={t("Queues")} data-home-card="queueList">
      {/* Only the rows re-render on the queue simulation's beat and the page clock. */}
      <QueueSubItems>
        {(subItems) => (
          <ClockTick>
            {(clockTick) => (
              <div role="list" className="flex flex-col px-1 pb-2">
                {buildLatestContacts(bases, subItems, clockTick).map((queue) => (
                  <div role="listitem" key={queue.id}>
                    <MenuItem
                      as="div"
                      comfortable={false}
                      data-queue-row={queue.id}
                      active={selectedId === queue.id}
                      icon={<queue.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />}
                      label={queue.name}
                      description={t("Longest wait {wait}", { wait: queue.wait })}
                      rightElement={
                        <span className="flex shrink-0 flex-col items-end lyra-body-sm">
                          <span className="lyra-label">{t("{count} waiting", { count: queue.contactsCount })}</span>
                          <span className="text-lyra-fg-secondary">{t("{count} agents", { count: queue.agentsCount })}</span>
                        </span>
                      }
                      onClick={() => onSelect(selectedId === queue.id ? null : queue.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </ClockTick>
        )}
      </QueueSubItems>
    </DashboardCard>
  );
}
