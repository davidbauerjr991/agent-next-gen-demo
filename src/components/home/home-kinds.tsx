// Each assignment kind's chip on Home and in the rail: its label, icon and
// Tag color (P-HOME-1; P-HOME-3 moves these into the kinds registry).
import {
  CalendarDays,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { Tag, type TagVariant } from "@nicecxone/lyra-ui";
import type { AssignmentKind } from "@/domain";
import { t } from "@/i18n";

const KIND_LABELS:Record<AssignmentKind, string> = {
  conversation: "Conversation",
  callback: "Callback",
  meeting: "Meeting",
  training: "Training",
  task: "Task",
  "campaign-block": "Campaign block",
  coaching: "Coaching",
  evaluation: "Evaluation",
};

const KIND_ICONS:Record<AssignmentKind, LucideIcon> = {
  conversation: MessageSquare,
  callback: PhoneCall,
  meeting: CalendarDays,
  training: GraduationCap,
  task: Ticket,
  "campaign-block": Megaphone,
  coaching: Compass,
  evaluation: ClipboardCheck,
};

const KIND_TAG_VARIANTS: Record<AssignmentKind, TagVariant> = {
  conversation: "teal",
  callback: "purple",
  meeting: "info",
  training: "warning",
  task: "pink",
  "campaign-block": "success",
  coaching: "purple",
  evaluation: "neutral",
};

export function KindIcon({ kind }: { kind: AssignmentKind }) {
  const Icon = KIND_ICONS[kind];
  return <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />;
}

/** A kind's name (English source; render through `t()`). */
export const kindLabel = (kind: AssignmentKind): string => KIND_LABELS[kind];

/** The kind's chip, with its icon. */
export function KindTag({ kind }: { kind: AssignmentKind }) {
  return <Tag shape="pill" variant={KIND_TAG_VARIANTS[kind]} icon={<KindIcon kind={kind} />} label={t(KIND_LABELS[kind])} />;
}
