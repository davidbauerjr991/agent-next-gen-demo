import * as React from "react";
import { MenuItem } from "@nicecxone/lyra-ui";
import type { FeedRow } from "@/contact-handling/home/activity-feed";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { t } from "@/i18n";
import { KindIcon, KindTag } from "./home-kinds";

const STATUS_LABELS: Record<FeedRow["status"], string> = {
  offered: "Waiting for you to accept",
  scheduled: "Scheduled",
  inRail: "Accepted · in Assignments",
  completed: "Completed",
};

/** One feed row: the kind's icon and chip, the title, the one-line detail
 *  with its source, the time or due, and the status. Clicking opens it.
 *  A `div` row (the notification-row shape) so `action` can hold a button. */
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
  const time = row.at !== undefined ? feedTimeLabel(row.at, now) : row.timeLabel;
  const detail = [row.subtitle, row.sourceLabel].filter(Boolean).join(" · ");
  return (
    <MenuItem
      as="div"
      data-feed-row={row.assignmentId}
      data-feed-status={row.status}
      data-selected={selected || undefined}
      active={selected}
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
