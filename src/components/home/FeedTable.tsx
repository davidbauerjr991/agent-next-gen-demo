// The Activity feed as a table (P-HOME-1m, `home.activityView: "table"`):
// the same rows the list shows, through lyra's table parts (the Customers
// table's Table / SortableTableHead / TableCell). The columns are data
// (`FEED_TABLE_COLUMNS`) over `FeedRow`, which Contact History's entries
// already map to (useActivityFeed's `historyRow`), so Phase 1's Contact
// History can render its own table from them. A row's click opens the same
// preview; the unread tint and dot, and the eye on a row open in the rail,
// carry over; the trailing cell holds the row's Park / Unpark / Delete.
import * as React from "react";
import { Badge, SortableTableHead, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, type SortDirection } from "@nicecxone/lyra-ui";
import { Eye } from "lucide-react";
import type { FeedRow } from "@/contact-handling/home/activity-feed";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { STATUS_LABELS } from "./ActivityRow";
import { KindTag, kindLabel } from "./home-kinds";

export type FeedTableColumnKey = "kind" | "title" | "customer" | "source" | "time" | "status";

export interface FeedTableColumn {
  key: FeedTableColumnKey;
  /** English source text (through `t()`). */
  label: string;
  /** Its sort key, when the column sorts. */
  sortValue?: (row: FeedRow) => string | number;
  className: string;
  cell: (row: FeedRow, now: number) => React.ReactNode;
}

/** A row's time: its own label (Contact History's "8m ago") over its timestamp. */
const timeOf = (row: FeedRow, now: number) => row.timeLabel ?? (row.at !== undefined ? feedTimeLabel(row.at, now) : "");

/** The columns: Kind, Title, Customer, Source, Due / Time, Status (sortable by Due, Kind, Customer and Status). */
export const FEED_TABLE_COLUMNS: readonly FeedTableColumn[] = [
  { key: "kind", label: "Kind", className: "w-[140px] shrink-0", sortValue: (row) => t(kindLabel(row.kind)), cell: (row) => <KindTag kind={row.kind} /> },
  {
    key: "title",
    label: "Title",
    className: "min-w-[200px] flex-[2]",
    cell: (row) => (
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {row.status === "inRail" ? (
            <Eye className="h-4 w-4 text-lyra-fg-secondary" strokeWidth={1.5} aria-label={t("Open")} />
          ) : (
            row.unread && <Badge shape="circle" variant="info" size="sm" dot aria-label={t("New")} />
          )}
        </span>
        <span className="truncate">{row.title}</span>
      </span>
    ),
  },
  { key: "customer", label: "Customer", className: "min-w-[140px] flex-1", sortValue: (row) => row.customer ?? "", cell: (row) => row.customer ?? "" },
  { key: "source", label: "Source", className: "min-w-[120px] flex-1", cell: (row) => row.sourceLabel ?? "" },
  { key: "time", label: "Due / Time", className: "w-[140px] shrink-0", sortValue: (row) => row.at ?? 0, cell: timeOf },
  { key: "status", label: "Status", className: "w-[130px] shrink-0", sortValue: (row) => t(STATUS_LABELS[row.status]), cell: (row) => t(STATUS_LABELS[row.status]) },
];

/** The rows sorted by a column (none: the feed's own order). */
function sorted(rows: readonly FeedRow[], key: FeedTableColumnKey | null, direction: SortDirection): readonly FeedRow[] {
  const column = FEED_TABLE_COLUMNS.find((c) => c.key === key);
  if (!column?.sortValue || !direction) return rows;
  const value = column.sortValue;
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sign;
  });
}

export function FeedTable({
  rows,
  now,
  onOpen,
  isSelected,
  actionsFor,
  ...rest
}: {
  rows: readonly FeedRow[];
  now: number;
  onOpen: (row: FeedRow) => void;
  isSelected: (row: FeedRow) => boolean;
  /** The trailing cell (the row's Park / Unpark / Delete), when it has any. */
  actionsFor?: (row: FeedRow) => React.ReactNode;
  "data-feed-table"?: string;
}) {
  const [sort, setSort] = React.useState<{ key: FeedTableColumnKey | null; direction: SortDirection }>({ key: null, direction: null });
  // A column's click: ascending, then descending, then the feed's own order.
  const onSort = (key: FeedTableColumnKey) =>
    setSort((prev) => (prev.key !== key ? { key, direction: "asc" } : prev.direction === "asc" ? { key, direction: "desc" } : { key: null, direction: null }));
  return (
    <Table {...rest}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {FEED_TABLE_COLUMNS.map((column) =>
            column.sortValue ? (
              <SortableTableHead
                key={column.key}
                columnKey={column.key}
                className={column.className}
                sortDirection={sort.key === column.key ? sort.direction : null}
                onSort={() => onSort(column.key)}
              >
                {t(column.label)}
              </SortableTableHead>
            ) : (
              <TableHead key={column.key} className={column.className}>
                {t(column.label)}
              </TableHead>
            ),
          )}
          <TableHead className="w-[88px] shrink-0">
            <span className="sr-only">{t("Actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted(rows, sort.key, sort.direction).map((row) => {
          const selected = isSelected(row);
          return (
            <TableRow
              key={row.assignmentId}
              selectable
              onClick={() => onOpen(row)}
              aria-selected={selected}
              data-feed-row={row.assignmentId}
              data-feed-status={row.status}
              data-selected={selected || undefined}
              data-unread={row.unread || undefined}
              className={cn("group cursor-pointer", selected ? "bg-lyra-status-info-subtle" : row.unread && "bg-lyra-state-hover")}
            >
              {FEED_TABLE_COLUMNS.map((column) => (
                <TableCell key={column.key} columnKey={column.key} className={column.className}>
                  {column.cell(row, now)}
                </TableCell>
              ))}
              <TableCell className="w-[88px] shrink-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                {actionsFor?.(row)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
