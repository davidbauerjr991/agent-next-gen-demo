// Marcus Webb's slide-over content (P-SHRINK): the bodies his script's rows
// and links open, as data and small components, served through the
// slide-over registry (src/contact-handling/slide-over-registry.ts). His
// decisions are Next Best Actions on the script (scripts/marcus-webb.ts);
// this file holds only what those rows open. Mock data only.
import React from "react";
import { Accordion, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag, type AccordionItem } from "@nicecxone/lyra-ui";
import { AlertTriangle, Check, CheckCircle2, CircleDot, Clock, PackageCheck, Phone, Sparkles } from "lucide-react";
import { KnowledgeArticleSummaryRow, type KnowledgeArticleCardData } from "@/components/agent-next-gen-knowledge-article-card";
import type { SlideOverRequest, SlideOverTable } from "@/contact-handling/slide-over-registry";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

// ── Data ─────────────────────────────────────────────────────────────────

interface MarcusWebbOrderInfo {
  orderId: string;
  itemName: string;
  price: string;
  orderedDate: string;
  status: string;
  shippingAddress: string;
}

const MARCUS_WEBB_ORDER: MarcusWebbOrderInfo = {
  orderId: "#48213",
  itemName: "Noise-Cancelling Headphones",
  price: "$200.00",
  orderedDate: "Last Tuesday",
  status: "Delivered — customer reported a cracked ear cup",
  shippingAddress: "412 Birchwood Lane, Springfield, IL 62704",
};

interface MarcusWebbTransaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: "purchase" | "damaged-claim";
}

// 5 of 10 recent orders came back as damaged-product claims (all electronics, like his headphones): the signal the
// agent is meant to notice.
const MARCUS_WEBB_TRANSACTIONS: MarcusWebbTransaction[] = [
  { id: "txn-1", date: "Jul 18, 2025", description: "Noise-cancelling headphones — cracked ear cup", amount: "$200.00", type: "damaged-claim" },
  { id: "txn-2", date: "Jul 2, 2025", description: "Wireless earbuds — case", amount: "$34.99", type: "purchase" },
  { id: "txn-3", date: "Jun 19, 2025", description: "Bluetooth speaker — water damage", amount: "$89.00", type: "damaged-claim" },
  { id: "txn-4", date: "Jun 3, 2025", description: "USB-C charging cable (3-pack)", amount: "$19.99", type: "purchase" },
  { id: "txn-5", date: "May 21, 2025", description: "Smart watch — cracked screen", amount: "$249.00", type: "damaged-claim" },
  { id: "txn-6", date: "May 8, 2025", description: "Phone case", amount: "$24.99", type: "purchase" },
  { id: "txn-7", date: "Apr 25, 2025", description: "Portable charger — swollen battery", amount: "$45.00", type: "damaged-claim" },
  { id: "txn-8", date: "Apr 11, 2025", description: "HDMI cable", amount: "$12.99", type: "purchase" },
  { id: "txn-9", date: "Mar 29, 2025", description: "Tablet stand — arrived broken", amount: "$29.00", type: "damaged-claim" },
  { id: "txn-10", date: "Mar 14, 2025", description: "Screen protector (2-pack)", amount: "$9.99", type: "purchase" },
];

const PHOTO_ARTICLE: KnowledgeArticleCardData = {
  id: "damage-photo-verification",
  title: "RET-4.1 · Verifying damage by photo",
  body: "Before approving a damage refund, ask the customer to send clear photos of the damaged item so the claim can be verified and attached to the order.",
  internalNote: "Photo verification is required for refunds over the $100 auto-approval limit. Do not approve until photos are on file.",
  webLinks: [],
  processSteps: [
    "Ask the customer to photograph the damage from at least two angles, including the packaging.",
    "Have them include the order number or packing slip in one photo.",
    "Attach the photos to the order and confirm the damage matches the report.",
    "Approve the refund, or request replacement photos if the damage can't be verified.",
  ],
};

const POLICY_ARTICLE: KnowledgeArticleCardData = {
  id: "refund-alternatives",
  title: "RET-2.3 · Refund exceptions and alternatives",
  body: "When a refund can't be approved as requested, offer an alternative resolution instead: a replacement, store credit, or escalation to a supervisor.",
  internalNote: "Claims over the $100 auto-approval limit that fail verification must not be refunded until a supervisor has reviewed them.",
  webLinks: [],
  processSteps: [
    "Explain to the customer why the refund can't be approved as requested.",
    "Offer a replacement or store credit for the full order value.",
    "If the customer declines, escalate the claim to a supervisor with the order and damage details.",
    "Log the outcome on the order so no money moves until a resolution is agreed.",
  ],
};

/** What a decision's work-item row (`action:<branch>`) shows: the question, the option the agent took, what the AI
 *  agent then did, and the policy behind it. The options and any note come from the Used row. */
const DECISIONS: Record<string, { context: string; chosen: string; title: string; steps: string[]; article?: KnowledgeArticleCardData }> = {
  approved: {
    context: "How would you like to proceed?",
    chosen: "Approve the refund",
    title: "Refund approved",
    steps: ["AI Agent contacting customer", "Waiting for customer response", 'Disposition updated to "Exception Approved"'],
    article: PHOTO_ARTICLE,
  },
  rejected: {
    context: "How would you like to proceed?",
    chosen: "Reject the refund",
    title: "Refund rejected",
    steps: ["AI Agent requesting photo of damaged item", "Waiting for customer response"],
    article: POLICY_ARTICLE,
  },
  "rejected-again": {
    context: "The customer sent a photo. How would you like to proceed?",
    chosen: "Reject and give another reason",
    title: "Refund rejected",
    steps: [],
    article: POLICY_ARTICLE,
  },
  flagged: {
    context: "The customer sent a photo. How would you like to proceed?",
    chosen: "Flag the account for review",
    title: "Instruction sent",
    steps: ["Flagging account for review", 'Updating status to "Escalated"', "Unassigning and dismissing assignment"],
  },
};

/** Copilot answers for Marcus's chips and questions, picked by what was asked. */
function copilotAnswer(question: string): { summary: string; points: string[] } | undefined {
  const q = question.toLowerCase();
  if (q.includes("summar")) {
    return {
      summary: "Marcus called about a $200 refund for noise-cancelling headphones (order #48213) that arrived with a cracked ear cup.",
      points: [
        "The AI agent verified the order and confirmed the damage report.",
        "The refund qualifies but exceeds the AI agent's $100 auto-approval limit.",
        "Marcus agreed to hold while a person reviews it.",
      ],
    };
  }
  if (q.includes("purchase history")) {
    return {
      summary: "Marcus has 10 orders in the last 12 months, 5 of them with damage claims.",
      points: [
        "#48213 · Noise-cancelling headphones · $200.00 · Delivered, damage reported",
        "Lifetime spend: $1,184.00 across 10 orders.",
        "5 damaged-product claims in the last 10 transactions.",
      ],
    };
  }
  if (q.includes("ai agent")) {
    return {
      summary: "The Cognigy AI Agent did everything within its authority before escalating.",
      points: [
        "Verified order #48213 and the $200.00 price.",
        "Confirmed the cracked ear cup and that the refund qualifies.",
        "Hit the $100 auto-approval limit and put Marcus on hold for sign-off.",
      ],
    };
  }
  return undefined;
}

/** The chips' panel keys (the script's `content.copilot.links`) and the question each answers. */
const COPILOT_CHIPS: Record<string, string> = {
  "copilot:summary": "Summarize this call",
  "copilot:purchases": "Show purchase history",
  "copilot:ai-tried": "What did the AI agent try?",
};

// ── Bodies ───────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="lyra-body-sm-emphasis text-lyra-fg-default">{label}</p>
      <div className="lyra-body-md text-lyra-fg-default">{children}</div>
    </div>
  );
}

function OrderBody() {
  const order = MARCUS_WEBB_ORDER;
  const fields: [string, string][] = [
    [t("Order ID"), order.orderId],
    [t("Item"), order.itemName],
    [t("Price"), order.price],
    [t("Ordered"), order.orderedDate],
    [t("Status"), order.status],
    [t("Shipping address"), order.shippingAddress],
  ];
  return (
    <div className="flex flex-col gap-4 p-4">
      {fields.map(([label, value]) => (
        <Field key={label} label={label}>
          {value}
        </Field>
      ))}
    </div>
  );
}

function TransactionsTable() {
  const claims = MARCUS_WEBB_TRANSACTIONS.filter((txn) => txn.type === "damaged-claim").length;
  return (
    <>
      <p className="lyra-body-md text-lyra-fg-default">
        {t("{claims} of the customer's last {count} transactions have been damaged-product claims.", { claims, count: MARCUS_WEBB_TRANSACTIONS.length })}
      </p>
      <div className="h-[420px]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="flex-[1.2]">{t("Date")}</TableHead>
              <TableHead className="flex-[3]">{t("Description")}</TableHead>
              <TableHead className="flex-1">{t("Amount")}</TableHead>
              <TableHead className="flex-[1.5]">{t("Type")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MARCUS_WEBB_TRANSACTIONS.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell className="flex-[1.2] text-lyra-fg-secondary">{txn.date}</TableCell>
                <TableCell className="flex-[3]">{txn.description}</TableCell>
                <TableCell className="flex-1 tabular-nums">{txn.amount}</TableCell>
                <TableCell className="flex-[1.5]">
                  {txn.type === "damaged-claim" ? <Tag variant="warning" label={t("Damaged Claim")} /> : <span className="text-lyra-fg-secondary">{t("Purchase")}</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

/** The active card's rows, every thread. */
function useActiveRows() {
  const { activeInteraction } = useWorkspace();
  return Object.values(activeInteraction?.liveMessages ?? {}).flat();
}

/** A Copilot result: a chip's (or a matching question's) answer; any other question is the order-history analysis —
 *  with the last 10 transactions the first time it's asked, and a note of the request after that. */
function CopilotResultBody({ request }: { request: SlideOverRequest }) {
  const rows = useActiveRows();
  const text = request.text ?? COPILOT_CHIPS[request.panel] ?? "";
  const row = rows.find((r) => r.instruction?.link === (request.link ?? request.panel));
  const time = request.time ?? row?.timestamp ?? "";
  const answer = copilotAnswer(text);
  const freeForm = rows.filter((r) => r.instruction?.link.startsWith("instruction:copilot:") && !copilotAnswer(r.instruction.title));
  const first = !answer && freeForm[0]?.instruction?.link === request.link;
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2 rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-surface-base p-3">
        <p className="flex items-center gap-1.5 lyra-body-sm-emphasis text-lyra-accent-purple-strong">
          <Sparkles className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          {t("Copilot result")}
        </p>
        {answer ? (
          <>
            <p className="lyra-body-md text-lyra-fg-default">{answer.summary}</p>
            <ul className="flex list-disc flex-col gap-1 ps-5 lyra-body-md text-lyra-fg-default">
              {answer.points.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="lyra-body-md text-lyra-fg-default">
            {t("I have analyzed the order history and it appears Marcus Webb has 5 damaged product claims in the last 10 transactions. This is an alarmingly high amount.")}
          </p>
        )}
      </div>
      {!answer && (first ? <TransactionsTable /> : <p className="lyra-body-md text-lyra-fg-default">{t('Agent Smith requested "{text}" at {time}.', { text, time })}</p>)}
      <Field label={t("Instruction")}>{text}</Field>
      <Field label={t("Sent")}>{t("{time} · by John Smith", { time })}</Field>
      <Field label={t("Sent to")}>{t("Copilot")}</Field>
      <Field label={t("Status")}>
        <Badge shape="pill" color="success" variant="subtle" fontSize={12}>
          {t("Answered")}
        </Badge>
      </Field>
    </div>
  );
}

/** A decision's work-item row: the question, every option with the one taken checked, the agent's note, the AI
 *  agent's steps and the policy article. */
function ActionDetailBody({ request }: { request: SlideOverRequest }) {
  const { setSelectedDetailPanelContent } = useWorkspace();
  const decision = DECISIONS[request.panel.slice("action:".length)];
  const used = useActiveRows()
    .map((r) => r.nbaOutcome)
    .filter((o) => o?.outcome === "used" && o.title === decision?.chosen)
    .pop();
  if (!decision) return null;
  const options = used?.options ?? [decision.chosen];
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="lyra-body-md-emphasis text-lyra-fg-default">{decision.context}</p>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const selected = option === decision.chosen;
          return (
            <div
              key={option}
              className={cn(
                "flex items-start gap-2 rounded-lyra-md border p-3",
                selected ? "border-lyra-border-active bg-lyra-bg-active-subtle" : "border-lyra-border-subtle bg-lyra-bg-surface-base",
              )}
            >
              {selected && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lyra-status-success-strong" strokeWidth={1.5} aria-hidden="true" />}
              <span className="lyra-body-md-emphasis text-lyra-fg-default">{option}</span>
            </div>
          );
        })}
      </div>
      {used?.note && <Field label={t("Details")}>"{used.note.value}"</Field>}
      {decision.steps.length > 0 && (
        <Field label={t("What the AI agent did")}>
          <ul className="flex flex-col gap-1">
            {decision.steps.map((step) => (
              <li key={step} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 shrink-0 text-lyra-status-success-strong" strokeWidth={2} aria-hidden="true" />
                {step}
              </li>
            ))}
          </ul>
        </Field>
      )}
      {decision.article && (
        <KnowledgeArticleSummaryRow data={decision.article} selected={false} onClick={() => setSelectedDetailPanelContent({ kind: "article", article: decision.article! })} />
      )}
    </div>
  );
}

const TIME = ({ children }: { children: React.ReactNode }) => <span className="lyra-body-sm text-lyra-fg-secondary">{children}</span>;

/** Experience Memory for Marcus Webb (refund case): the same accordion layout as Lucas's, with his own events. */
export function MarcusWebbMemoryPanelBody({ onOpenOrder, focus = "refund-escalated" }: { onOpenOrder?: () => void; focus?: string }) {
  const [openIds, setOpenIds] = React.useState<string[]>([focus]);
  React.useEffect(() => setOpenIds([focus]), [focus]);
  const items: AccordionItem[] = [
    {
      id: "order-placed",
      headerClassName: focus === "order-placed" ? "bg-lyra-accent-purple-soft" : undefined,
      title: "Order placed",
      subhead: "Web · Order #48213",
      icon: <PackageCheck className="h-5 w-5 text-lyra-status-info-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>Last Tuesday</TIME>,
      content: <p className="lyra-body-md text-lyra-fg-default">Marcus ordered Noise-Cancelling Headphones for $200.00. Delivery was confirmed a few days later.</p>,
    },
    {
      id: "damage-reported",
      headerClassName: focus === "damage-reported" ? "bg-lyra-accent-purple-soft" : undefined,
      title: "Damage reported",
      subhead: "Phone · Customer reported on delivery",
      icon: <AlertTriangle className="h-5 w-5 text-lyra-status-warning-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>Today</TIME>,
      content: <p className="lyra-body-md text-lyra-fg-default">Marcus called to report that the headphones arrived with a cracked ear cup and asked for a refund.</p>,
    },
    {
      id: "refund-escalated",
      title: "Refund escalated for approval",
      subhead: "Cognigy AI Agent · Marcus placed on hold",
      icon: <Clock className="h-5 w-5 text-lyra-accent-purple-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>Today</TIME>,
      headerClassName: focus === "refund-escalated" ? "bg-lyra-accent-purple-soft" : undefined,
      content: (
        <ol className="flex flex-col gap-2.5">
          {[
            { label: "Order #48213 verified", state: "done" },
            { label: "Damage report confirmed", state: "done" },
            { label: "$200 refund qualifies · exceeds $100 limit", state: "done" },
            { label: "Waiting for human sign-off", state: "current" },
            { label: "Refund processed · customer taken off hold", state: "todo" },
          ].map((step, i) => (
            <li key={step.label} className="flex items-center gap-2">
              {step.state === "done" ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lyra-status-success-strong text-white">
                  <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                </span>
              ) : (
                <span
                  className={
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border lyra-body-xs " +
                    (step.state === "current" ? "border-lyra-status-warning-strong text-lyra-status-warning-strong" : "border-lyra-border-subtle text-lyra-fg-secondary")
                  }
                >
                  {i + 1}
                </span>
              )}
              <span className={"min-w-0 flex-1 lyra-body-md " + (step.state === "todo" ? "text-lyra-fg-secondary" : "text-lyra-fg-default")}>{step.label}</span>
            </li>
          ))}
        </ol>
      ),
    },
    {
      id: "call-started",
      title: "Call started",
      subhead: "Voice",
      icon: <Phone className="h-5 w-5 text-lyra-status-info-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>Today</TIME>,
      content: <p className="lyra-body-md text-lyra-fg-default">Marcus called in and was answered by the Cognigy AI Agent.</p>,
    },
  ];
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="lyra-body-md text-lyra-fg-secondary">
        Calling about a refund on a $200 order. The refund exceeds the AI agent's $100 auto-approval limit, so it was escalated for human approval.
      </p>
      <Accordion type="multiple" variant="contained" values={openIds} onValuesChange={setOpenIds} items={items} />
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 lyra-body-md-emphasis text-lyra-fg-default">
          <CircleDot className="h-4 w-4 text-lyra-accent-purple-strong" strokeWidth={1.5} aria-hidden="true" />
          Purchases
        </span>
        <ul className="divide-y divide-lyra-border-subtle overflow-hidden rounded-lyra-md border border-lyra-border-subtle">
          <li className="flex items-baseline justify-between gap-3 bg-lyra-accent-purple-soft px-3 py-2.5">
            <span className="min-w-0 truncate">
              {onOpenOrder ? (
                <button type="button" onClick={onOpenOrder} className="lyra-body-md text-lyra-fg-link hover:underline focus-visible:outline-none focus-visible:underline">
                  Noise-Cancelling Headphones
                </button>
              ) : (
                <span className="lyra-body-md text-lyra-fg-default">Noise-Cancelling Headphones</span>
              )}
              <span className="lyra-body-sm text-lyra-fg-secondary"> · #48213 · Last Tuesday</span>
            </span>
            <span className="shrink-0 lyra-body-sm text-lyra-fg-default">$200.00 · Damaged</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// ── The registry entries ─────────────────────────────────────────────────

const copilotTitle = (r: SlideOverRequest) => r.text ?? COPILOT_CHIPS[r.panel] ?? t("Copilot result");

/** Marcus's panel keys: the order, the Copilot chips and questions (`instruction:` rows), and each decision's
 *  work-item row (`action:<branch>`). */
export const MARCUS_WEBB_SLIDE_OVERS: SlideOverTable = {
  order: { title: () => MARCUS_WEBB_ORDER.itemName, Body: OrderBody },
  ...Object.fromEntries(Object.keys(COPILOT_CHIPS).map((key) => [key, { title: copilotTitle, subhead: () => t("John Smith"), Body: CopilotResultBody }])),
  "instruction:": { title: copilotTitle, subhead: (r) => (r.time ? t("{time} · John Smith", { time: r.time }) : undefined), Body: CopilotResultBody },
  "action:": { title: (r) => DECISIONS[r.panel.slice("action:".length)]?.title ?? "", subhead: (r) => r.time, Body: ActionDetailBody },
};
