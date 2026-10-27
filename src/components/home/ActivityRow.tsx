import * as React from "react";
import { Badge, MenuItem } from "@nicecxone/lyra-ui";
import type { FeedRow } from "@/contact-handling/home/activity-feed";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { KindIcon, KindTag } from "./home-kinds";

const STATUS_LABELS: Record<FeedRow["status"], string> = {
  offered: "Waiting for you to accept",
  scheduled: "Scheduled",
  inRail: "Accepted · in Assignments",
  completed: "Completed",
  parked: "Parked",
};

/** One feed row: the kind's icon and chip, the title, the one-line detail
 *  with its source, the time or due, and the status. Clicking opens it.
 *  A `div` row (the notification-row shape) so `action` can hold a button:
 *  P-HOME-1k's hover cluster (Park / Unpark / Delete), shown on hover or
 *  focus. An unread row's title is bold with a leading dot; a read one's is
 *  regular. */
export function ActivityRow({
  row,
  now,
  onOpen,
  action,
  selected = false,
}: {
  row: FeedRow;
  now: number;
  onOpen: () => void;
  action?: React.ReactNode;
  /** Its preview is open (a History row, as Contact History's selected row). */
  selected?: boolean;
}) {
  // A row's own label (Contact History's "8m ago") wins over its timestamp.
  const time = row.timeLabel ?? (row.at !== undefined ? feedTimeLabel(row.at, now) : undefined);
  const detail = [row.subtitle, row.sourceLabel].filter(Boolean).join(" · ");
  return (
    <MenuItem
      as="div"
      data-feed-row={row.assignmentId}
      data-feed-status={row.status}
      data-selected={selected || undefined}
      data-unread={row.unread || undefined}
      active={selected}
      className="group"
      icon={<KindIcon kind={row.kind} />}
      header={
        <span className="flex min-w-0 items-center gap-1.5">
          {row.unread && <Badge shape="circle" variant="info" size="sm" dot aria-label={t("New")} />}
          <span className={cn("truncate", !row.unread && "lyra-body-md")}>{row.title}</span>
        </span>
      }
      label={detail}
      description={time}
      onClick={onOpen}
      rightElement={
        <span className="flex shrink-0 items-center gap-3">
          {action && (
            <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">{action}</span>
          )}
          <span className="flex flex-col items-end gap-1">
            <KindTag kind={row.kind} />
            <span className="lyra-body-xs text-lyra-fg-secondary">{t(STATUS_LABELS[row.status])}</span>
          </span>
        </span>
      }
    />
  );
}
