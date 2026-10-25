import * as React from "react";
import { MenuItem } from "@nicecxone/lyra-ui";
import type { FeedRow } from "@/contact-handling/home/activity-feed";
import { t } from "@/i18n";
import { KindIcon, KindTag } from "./home-kinds";

const STATUS_LABELS: Record<FeedRow["status"], string> = {
  offered: "Waiting for you to accept",
  scheduled: "Scheduled",
  inRail: "Accepted · in Assignments",
  completed: "Completed",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** "11:00 AM" today; "Tue 11:30 AM" another day. */
export function feedTimeLabel(at: number, now: number): string {
  const sameDay = new Date(at).toDateString() === new Date(now).toDateString();
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(at);
  if (sameDay) return time;
  const day = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(at);
  return Math.abs(at - now) < 7 * DAY_MS ? `${day} ${time}` : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(at);
}

/** One feed row: the kind's icon and chip, the title, the one-line detail
 *  with its source, the time or due, and the status. Clicking opens it.
 *  A `div` row (the notification-row shape) so `action` can hold a button. */
export function ActivityRow({ row, now, onOpen, action }: { row: FeedRow; now: number; onOpen: () => void; action?: React.ReactNode }) {
  const time = row.at !== undefined ? feedTimeLabel(row.at, now) : row.timeLabel;
  const detail = [row.subtitle, row.sourceLabel].filter(Boolean).join(" · ");
  return (
    <MenuItem
      as="div"
      data-feed-row={row.assignmentId}
      data-feed-status={row.status}
      icon={<KindIcon kind={row.kind} />}
      header={row.title}
      label={detail}
      description={time}
      onClick={onOpen}
      rightElement={
        <span className="flex shrink-0 flex-col items-end gap-1">
          <KindTag kind={row.kind} />
          <span className="lyra-body-xs text-lyra-fg-secondary">{t(STATUS_LABELS[row.status])}</span>
          {action}
        </span>
      }
    />
  );
}
