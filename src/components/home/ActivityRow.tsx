import * as React from "react";
import { Badge, MenuItem } from "@nicecxone/lyra-ui";
import type { FeedRow } from "@/contact-handling/home/activity-feed";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { Eye } from "lucide-react";
import { KindTag } from "./home-kinds";

/** A row's status in words (English source; through `t()`): the list's and the table's (FeedTable). */
export const STATUS_LABELS: Record<FeedRow["status"], string> = {
  offered: "Waiting for you to accept",
  scheduled: "Scheduled",
  inRail: "Open",
  completed: "Completed",
  parked: "Parked",
};

/** One feed row: the title, the one-line detail with its source, the time or
 *  due, and on the right the kind's chip and the status. Clicking opens it.
 *  A `div` row (the notification-row shape) so `action` can hold buttons:
 *  P-HOME-1k's Park / Unpark / Delete, immediately left of the chip (1m),
 *  shown on hover or focus. P-HOME-1m: the left slot holds only the unread
 *  dot, or an eye for an item open in the rail (the chip carries the kind);
 *  an unread row is tinted (the hover tint, lighter than selected), a read
 *  one plain. */
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
      className={cn("group", row.unread && !selected && "bg-lyra-state-hover")}
      icon={
        <span className="flex h-4 w-4 items-center justify-center">
          {row.status === "inRail" ? (
            <Eye className="h-4 w-4 text-lyra-fg-secondary" strokeWidth={1.5} aria-label={t("Open")} />
          ) : (
            row.unread && <Badge shape="circle" variant="info" size="sm" dot aria-label={t("New")} />
          )}
        </span>
      }
      // Regular weight for every title (MenuItem's header is emphasis): unread is the tint and the dot, not bold.
      header={<span className="lyra-body-md">{row.title}</span>}
      label={detail}
      description={time}
      onClick={onOpen}
      rightElement={
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="flex items-center gap-2">
            {action && <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">{action}</span>}
            <KindTag kind={row.kind} />
          </span>
          <span className="lyra-body-xs text-lyra-fg-secondary">{t(STATUS_LABELS[row.status])}</span>
        </span>
      }
    />
  );
}
