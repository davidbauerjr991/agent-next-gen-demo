import type { EpochMs } from "../../domain";
import type { ScheduleCardMetric, ScheduleItem, ScheduleRole } from "../../providers";

// One seeded day per role (PLAN.md "Persona (demo)"; the wireframe's
// docs/activity-home-wireframe.html). Times are minutes from when the day is
// listed, so the feed always has something in Now / Today / This week.
// Content is data, like the scenario scripts.

type SeedItem = Omit<ScheduleItem, "dueAt" | "completedAt"> & { inMin: number };

const AGENT_DAY: readonly SeedItem[] = [
  {
    id: "agent-cb-priya",
    kind: "callback",
    title: "Callback · Priya Shah",
    subtitle: "Requested yesterday · refund hasn't posted",
    sourceLabel: "Customer request",
    customer: { name: "Priya Shah" },
    inMin: 30,
    state: "scheduled",
    detail: { kind: "callback", phone: "(646) 555-0143", reason: "Refund RF-20451 hasn't posted" },
  },
  {
    id: "agent-mt-standup",
    kind: "meeting",
    title: "Returns team stand-up",
    subtitle: "Teams · 15 min · 6 attendees",
    sourceLabel: "Calendar",
    inMin: 90,
    durationMin: 15,
    state: "scheduled",
    detail: {
      kind: "meeting",
      attendees: 6,
      agenda: ["Refund policy RET-1.3 rollout", "WhatsApp go-live next week", "Open escalations"],
      joinLabel: "Join (Teams)",
    },
  },
  {
    id: "agent-tr-ret13",
    kind: "training",
    title: "RET-1.3 refund policy update",
    subtitle: "Module · 20 min · due Friday",
    sourceLabel: "WFM",
    inMin: 180,
    durationMin: 20,
    state: "scheduled",
    detail: { kind: "training", module: "RET-1.3 refund policy update", dueLabel: "Due Friday" },
  },
  {
    id: "agent-tk-4821",
    kind: "task",
    title: "Ticket #4821 · subscription renewal refund",
    subtitle: "Follow up with Billing on the credit",
    sourceLabel: "Ticket queue",
    customer: { name: "Priya Shah", phone: "(646) 555-0143" },
    inMin: 240,
    state: "scheduled",
    detail: {
      kind: "task",
      ticket: "#4821",
      summary: "Credit RF-20452 is stuck in review; ask Billing to release it.",
      actions: ["Update ticket", "Message Billing"],
    },
  },
  {
    id: "agent-cb-sofia",
    kind: "callback",
    title: "Callback · Sofia Ramirez",
    subtitle: "Confirm the replacement shipped",
    sourceLabel: "Agent scheduled",
    customer: { name: "Sofia Ramirez" },
    inMin: 330,
    state: "scheduled",
    detail: { kind: "callback", phone: "(312) 555-0188", reason: "Confirm the replacement tank shipped" },
  },
  {
    id: "agent-cb-nathan",
    kind: "callback",
    title: "Callback · Nathan Cole",
    subtitle: "Confirm access after the reset",
    sourceLabel: "Agent scheduled",
    customer: { name: "Nathan Cole" },
    inMin: 1500,
    state: "scheduled",
    detail: { kind: "callback", phone: "(415) 555-0119", reason: "Confirm access after the password reset" },
  },
  {
    id: "agent-mt-dana",
    kind: "meeting",
    title: "1:1 with Dana (supervisor)",
    subtitle: "30 min",
    sourceLabel: "Calendar",
    inMin: 2900,
    durationMin: 30,
    state: "scheduled",
    detail: { kind: "meeting", attendees: 2, agenda: ["Last week's CSAT", "RET-1.3 questions"], joinLabel: "Join (Teams)" },
  },
  {
    id: "agent-tr-whatsapp",
    kind: "training",
    title: "WhatsApp templates · intro",
    subtitle: "Module · 25 min",
    sourceLabel: "WFM",
    inMin: 4300,
    durationMin: 25,
    state: "scheduled",
    detail: { kind: "training", module: "WhatsApp templates · intro" },
  },
  // Past the week: "Later", when the Assignments range is Next 30 days or All (P-HOME-1h).
  {
    id: "agent-tr-q4-compliance",
    kind: "training",
    title: "Q4 compliance refresher",
    subtitle: "Module · 30 min · due in two weeks",
    sourceLabel: "WFM",
    inMin: 14 * 24 * 60,
    durationMin: 30,
    state: "scheduled",
    detail: { kind: "training", module: "Q4 compliance refresher", dueLabel: "Due in two weeks" },
  },
];

const SUPERVISOR_DAY: readonly SeedItem[] = [
  {
    id: "sup-esc-briggs",
    kind: "conversation",
    title: "Escalation · Lauren Briggs · Voice",
    subtitle: "Agent raised hand · fraud dispute",
    sourceLabel: "Escalation",
    customer: { name: "Lauren Briggs" },
    inMin: -2,
    state: "offered",
    detail: { kind: "conversation", channel: "voice", summary: "Fraud dispute; John Smith raised his hand" },
  },
  {
    id: "sup-ev-lucas",
    kind: "evaluation",
    title: "Evaluate · Lucas Thomas chat (Checkout AI)",
    subtitle: "Scorecard · AI auto-score ready for review",
    sourceLabel: "QM",
    inMin: 20,
    state: "scheduled",
    detail: { kind: "evaluation", points: ["Greeting · AI: 5/5", "Verification · AI: 3/5 — review", "Resolution · AI: 4/5"] },
  },
  {
    id: "sup-co-john",
    kind: "coaching",
    title: "Coaching · John Smith",
    subtitle: "Review 2 calls from Thursday · 30 min",
    sourceLabel: "QM",
    inMin: 60,
    durationMin: 30,
    state: "scheduled",
    detail: { kind: "coaching", points: ["Both calls: long holds before the refund decision", "Suggested focus: RET-1.3 authority limits"] },
  },
  {
    id: "sup-mt-standup",
    kind: "meeting",
    title: "Returns team stand-up",
    subtitle: "Teams · 15 min · 6 attendees",
    sourceLabel: "Calendar",
    inMin: 90,
    durationMin: 15,
    state: "scheduled",
    detail: {
      kind: "meeting",
      attendees: 6,
      agenda: ["Refund policy RET-1.3 rollout", "WhatsApp go-live next week", "Open escalations"],
      joinLabel: "Join (Teams)",
    },
  },
  {
    id: "sup-ev-maya",
    kind: "evaluation",
    title: "Evaluate · Maya Chen call (Returns)",
    subtitle: "Scorecard · AI auto-score ready for review",
    sourceLabel: "QM",
    inMin: 150,
    state: "scheduled",
    detail: { kind: "evaluation", points: ["Greeting · AI: 5/5", "Verification · AI: 5/5", "Resolution · AI: 3/5 — review"] },
  },
  {
    id: "sup-co-priya",
    kind: "coaching",
    title: "Coaching · Priya Nair",
    subtitle: "Adherence follow-up · 20 min",
    sourceLabel: "QM",
    inMin: 2800,
    durationMin: 20,
    state: "scheduled",
    detail: { kind: "coaching", points: ["Three adherence exceptions this week", "Break schedule options"] },
  },
  {
    id: "sup-done-ev",
    kind: "evaluation",
    title: "Evaluate · Nathan Cole call",
    subtitle: "Scorecard · submitted",
    sourceLabel: "QM",
    inMin: -75,
    state: "done",
    detail: { kind: "evaluation", points: ["Overall 4.4 / 5"] },
  },
];

const SALES_DAY: readonly SeedItem[] = [
  {
    id: "sales-fu-acme",
    kind: "callback",
    title: "Follow-up · Acme Corp · Omar Farooq",
    subtitle: "Quote sent Tuesday · decision due",
    sourceLabel: "Sales cadence",
    customer: { name: "Omar Farooq" },
    inMin: 45,
    state: "scheduled",
    detail: { kind: "callback", phone: "(206) 555-0170", reason: "Quote sent Tuesday; decision due" },
  },
  {
    id: "sales-mt-demo",
    kind: "meeting",
    title: "Demo · Contoso · product walkthrough",
    subtitle: "Teams · 45 min · 4 attendees",
    sourceLabel: "Calendar",
    inMin: 120,
    durationMin: 45,
    state: "scheduled",
    detail: { kind: "meeting", attendees: 4, agenda: ["Discovery recap", "Live walkthrough", "Pricing and next steps"], joinLabel: "Join (Teams)" },
  },
  {
    id: "sales-cb-q4",
    kind: "campaign-block",
    title: "Campaign block · Q4 renewals · 2:00–3:30",
    subtitle: "24 contacts · cadence step 2 (voice)",
    sourceLabel: "Campaigns",
    inMin: 210,
    durationMin: 90,
    state: "scheduled",
    detail: {
      kind: "campaign-block",
      points: ["Acme Corp · Omar Farooq · renewal due Nov 1", "Northwind · Lauren Briggs · renewal due Nov 3"],
    },
  },
  {
    id: "sales-fu-northwind",
    kind: "callback",
    title: "Follow-up · Northwind · Lauren Briggs",
    subtitle: "Renewal call · cadence step 3",
    sourceLabel: "Sales cadence",
    customer: { name: "Lauren Briggs" },
    inMin: 1560,
    state: "scheduled",
    detail: { kind: "callback", phone: "(503) 555-0152", reason: "Renewal call; cadence step 3" },
  },
];

const DAYS: Record<ScheduleRole, readonly SeedItem[]> = { agent: AGENT_DAY, supervisor: SUPERVISOR_DAY, sales: SALES_DAY };

/** Each role's Home card figures, keyed by `home.sections` key. */
export const SIM_SCHEDULE_CARDS: Record<ScheduleRole, Readonly<Record<string, readonly ScheduleCardMetric[]>>> = {
  agent: {},
  supervisor: {
    teamQueues: [
      { label: "Returns", value: "7 waiting", hint: "longest 4:12", tone: "critical" },
      { label: "Billing", value: "3 waiting", hint: "longest 1:05" },
      { label: "Escalations", value: "1 waiting", hint: "longest 0:40" },
      { label: "Agents", value: "14 available", hint: "9 on contact · 2 ACW" },
    ],
    teamToday: [
      { label: "Service level (Returns)", value: "78%", hint: "target 80% / 20s", tone: "critical" },
      { label: "Handled", value: "212" },
      { label: "AHT", value: "6:48" },
      { label: "Adherence", value: "93%" },
      { label: "CSAT", value: "4.5" },
    ],
    needsYou: [
      { label: "Evaluations due today", value: "2" },
      { label: "Hands raised", value: "1", hint: "Lauren Briggs", tone: "warning" },
      { label: "Adherence exceptions", value: "3" },
    ],
  },
  sales: {
    pipeline: [
      { label: "Open opportunities", value: "18" },
      { label: "Closing this month", value: "$148,000", hint: "6 deals" },
      { label: "Stalled", value: "2", hint: "no touch in 14 days", tone: "warning" },
    ],
    campaignToday: [
      { label: "Q4 renewals", value: "24 contacts", hint: "cadence step 2 (voice)" },
      { label: "Reached", value: "0 of 24", hint: "block starts 2:00" },
      { label: "Opt-outs", value: "0" },
    ],
    followUps: [
      { label: "Due today", value: "2" },
      { label: "Overdue", value: "1", hint: "Fabrikam · quote follow-up", tone: "critical" },
      { label: "This week", value: "7" },
    ],
  },
};

/** `role`'s seeded day, timed from `now`. */
export function seedScheduleDay(role: ScheduleRole, now: EpochMs): ScheduleItem[] {
  return DAYS[role].map(({ inMin, ...item }) => {
    const dueAt = now + inMin * 60_000;
    return item.state === "done" ? { ...item, dueAt, completedAt: dueAt } : { ...item, dueAt };
  });
}
