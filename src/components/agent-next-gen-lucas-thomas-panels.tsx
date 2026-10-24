// Interior slide-out panel bodies for the Lucas Thomas snapshot links
// (product, payment history, pay-another-way link). Mock data only.
import React from "react";
import { Accordion, Badge, type AccordionItem, type BadgeColor } from "@nicecxone/lyra-ui";
import { Sparkles, AlertTriangle, Check, CircleDot, Clock, MessageCircle, MousePointerClick, PackageCheck, Phone } from "lucide-react";

export type LucasThomasPanelKey = "product" | "payments" | "payment-link" | "article-pay-3-2" | "purchase-history" | "fraud-screening" | "payment-preferences" | "ai-attempts" | "shipping-check";

export const LUCAS_THOMAS_PANEL_TITLES: Record<LucasThomasPanelKey, { title: string; subhead: string }> = {
  product: { title: "Aurora X2 launch edition", subhead: "Product details" },
  payments: { title: "Payment history", subhead: "Lucas Thomas" },
  "payment-link": { title: "Pay-another-way link", subhead: "Sent 2:06 PM" },
  "purchase-history": { title: "Purchase history", subhead: "Lucas Thomas" },
  "fraud-screening": { title: "Fraud screening results", subhead: "Lucas Thomas · NR-11056" },
  "payment-preferences": { title: "Payment preferences", subhead: "Lucas Thomas" },
  "shipping-check": { title: "Order processing and shipping", subhead: "NR-11056 · Checkout AI Agent" },
  "ai-attempts": { title: "What the AI agent tried", subhead: "Checkout AI Agent · today" },
  "article-pay-3-2": { title: "PAY-3.2 · Launch price holds", subhead: "Knowledge article" },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="lyra-body-sm-emphasis text-lyra-fg-default">{label}</p>
      <div className="lyra-body-md text-lyra-fg-default">{children}</div>
    </div>
  );
}

export function LucasThomasProductPanelBody() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Field label="Product">Aurora X2 · Launch edition</Field>
      <Field label="Description">
        Limited launch edition of the Aurora X2 with the extended-battery pack and a numbered collector's case. Ships
        with a 2-year warranty and free first-year software updates.
      </Field>
      <Field label="Launch price">$189.00 · held for Lucas for 24 h</Field>
      <Field label="Regular price">$229.00 after launch</Field>
      <Field label="Availability">Launch allocation · 1 unit held</Field>
      <Field label="SKU">AUR-X2-LE-01</Field>
      <Field label="Related order">NR-11056 · not placed</Field>
    </div>
  );
}

const PAYMENTS: { time: string; detail: string; amount: string; status: "Declined" | "Paid" }[] = [
  { time: "Today · 2:08 PM", detail: "Pay-another-way link · PayPal", amount: "$189.00", status: "Declined" },
  { time: "Today · 2:03 PM", detail: "Visa ending 4417 · NR-11056 (retry)", amount: "$189.00", status: "Declined" },
  { time: "Today · 2:01 PM", detail: "Visa ending 4417 · NR-11056", amount: "$189.00", status: "Declined" },
  { time: "Sep 26", detail: "PayPal · NR-10982", amount: "$64.00", status: "Paid" },
  { time: "Sep 9", detail: "PayPal · NR-10871", amount: "$32.50", status: "Paid" },
  { time: "Aug 21", detail: "Visa ending 4417 · NR-10790", amount: "$118.00", status: "Paid" },
];

export function LucasThomasPaymentsPanelBody() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="lyra-body-md text-lyra-fg-secondary">
        Card payments failed twice during payment incident INC-2207. Earlier payments went through.
      </p>
      <ul className="flex flex-col divide-y divide-lyra-border-subtle rounded-lyra-md border border-lyra-border-subtle">
        {PAYMENTS.map((p) => (
          <li key={p.time + p.detail} className="flex items-start justify-between gap-3 px-3 py-2.5">
            <div className="flex min-w-0 flex-col">
              <span className="lyra-body-md-emphasis text-lyra-fg-default">{p.detail}</span>
              <span className="lyra-body-sm text-lyra-fg-secondary">{p.time}</span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="lyra-body-md text-lyra-fg-default">{p.amount}</span>
              <Badge shape="pill" color={p.status === "Paid" ? "success" : "critical"} variant="subtle" fontSize={12}>
                {p.status}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LucasThomasPaymentLinkPanelBody() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Field label="Link">Secure pay-another-way link</Field>
      <Field label="Sent">2:06 PM · by Checkout AI Agent · in chat</Field>
      <Field label="Status">
        <Badge shape="pill" color="critical" variant="subtle" fontSize={12}>
          Payment failed
        </Badge>
      </Field>
      <Field label="Attempt">PayPal · 2:08 PM · declined by the payment service</Field>
      <Field label="Amount">$189.00 (held launch price)</Field>
      <Field label="Expires">In 24 h with the launch price hold</Field>
    </div>
  );
}

/* ── Experience Memory panel ──
   Built on lyra-ui's `Accordion` (contained variant) with rich headers
   (icon + title + subhead + time end-slot), `lyra-body-md`/`-sm` type
   throughout. The item matching `focus` is opened and its header tinted. */

export type LucasThomasMemoryFocus = "card-declined" | "link-requested" | "payment-review" | "order";

const MEMORY_STEPS: { label: string; time?: string; state: "done" | "current" | "todo"; n: number }[] = [
  { n: 1, label: "Review opened for NR-11056", time: "2:04 PM", state: "done" },
  { n: 2, label: "Linked to INC-2207", time: "2:04 PM", state: "done" },
  { n: 3, label: "Waiting on the payment fix", time: "2:04 PM", state: "current" },
  { n: 4, label: "Fix deployed · verifying", state: "todo" },
  { n: 5, label: "Resolved · held orders released", state: "todo" },
];

export type LucasThomasOrderId = "o2" | "o3" | "o4";

const ORDERS: { id: "order" | LucasThomasOrderId; name: string; meta: string; right: string }[] = [
  { id: "order", name: "Aurora X2 launch edition", meta: "NR-11056", right: "$189.00 · Card declined · held" },
  { id: "o2", name: "Studio headphones", meta: "NR-10988 · Aug 30", right: "$249.00 · PayPal" },
  { id: "o3", name: "Aurora X1 case", meta: "NR-10642 · Jul 12", right: "$39.00 · PayPal" },
  { id: "o4", name: "Charging dock", meta: "NR-10377 · May 3", right: "$59.00 · Visa 4417" },
];

export const LUCAS_THOMAS_ORDER_DETAILS: Record<
  LucasThomasOrderId,
  { orderId: string; item: string; price: string; ordered: string; payment: string; status: string; delivered: string; address: string }
> = {
  o2: {
    orderId: "NR-10988",
    item: "Studio headphones",
    price: "$249.00",
    ordered: "Aug 30",
    payment: "PayPal",
    status: "Delivered",
    delivered: "Sep 3",
    address: "1420 Harbor St, Apt 5B, Portland, OR 97209",
  },
  o3: {
    orderId: "NR-10642",
    item: "Aurora X1 case",
    price: "$39.00",
    ordered: "Jul 12",
    payment: "PayPal",
    status: "Delivered",
    delivered: "Jul 16",
    address: "1420 Harbor St, Apt 5B, Portland, OR 97209",
  },
  o4: {
    orderId: "NR-10377",
    item: "Charging dock",
    price: "$59.00",
    ordered: "May 3",
    payment: "Visa ending 4417",
    status: "Delivered",
    delivered: "May 7",
    address: "1420 Harbor St, Apt 5B, Portland, OR 97209",
  },
};

export function LucasThomasOrderPanelBody({ orderId }: { orderId: LucasThomasOrderId }) {
  const o = LUCAS_THOMAS_ORDER_DETAILS[orderId];
  return (
    <div className="flex flex-col gap-4 p-4">
      <Field label="Order ID">{o.orderId}</Field>
      <Field label="Item">{o.item}</Field>
      <Field label="Price">{o.price}</Field>
      <Field label="Ordered">{o.ordered}</Field>
      <Field label="Payment">{o.payment}</Field>
      <Field label="Status">
        <Badge shape="pill" color="success" variant="subtle" fontSize={12}>
          {o.status}
        </Badge>{" "}
        <span className="lyra-body-sm text-lyra-fg-secondary">on {o.delivered}</span>
      </Field>
      <Field label="Shipping address">{o.address}</Field>
    </div>
  );
}

const TIME = ({ children }: { children: React.ReactNode }) => (
  <span className="lyra-body-sm text-lyra-fg-secondary">{children}</span>
);

const FOCUS_TO_ITEM: Record<LucasThomasMemoryFocus, string | undefined> = {
  "card-declined": "card-declined",
  "link-requested": "link-requested",
  "payment-review": "payment-review",
  order: undefined,
};


function LucasThomasPurchasesSection({
  focus,
  onOpenOrder,
}: {
  focus?: LucasThomasMemoryFocus;
  onOpenOrder?: (orderId: LucasThomasOrderId) => void;
}) {
  return (
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 lyra-body-md-emphasis text-lyra-fg-default">
          <CircleDot className="h-4 w-4 text-lyra-accent-purple-strong" strokeWidth={1.5} aria-hidden="true" />
          Purchases and payment
        </span>
        <div className="flex flex-wrap gap-2">
          {[
            "Paid by PayPal on 3 of last 5 orders",
            "Prefers text for updates",
            "Pre-orders launch editions",
            "Aurora X1 pre-order failed at checkout · Apr 12",
          ].map((chip) => (
            <span key={chip} className="rounded-full bg-lyra-state-hover px-3 py-1 lyra-body-sm text-lyra-fg-default">
              {chip}
            </span>
          ))}
        </div>
        <ul className="divide-y divide-lyra-border-subtle overflow-hidden rounded-lyra-md border border-lyra-border-subtle">
          {ORDERS.map((o) => {
            const highlighted = focus === "order" && o.id === "order";
            return (
              <li
                key={o.id}
                className={"flex items-baseline justify-between gap-3 px-3 py-2.5 " + (highlighted ? "bg-lyra-accent-purple-soft" : "")}
              >
                <span className="min-w-0 truncate">
                  {o.id !== "order" && onOpenOrder ? (
                    <button
                      type="button"
                      onClick={() => onOpenOrder(o.id as LucasThomasOrderId)}
                      className="lyra-body-md text-lyra-fg-link hover:underline focus-visible:outline-none focus-visible:underline"
                    >
                      {o.name}
                    </button>
                  ) : (
                    <span className="lyra-body-md text-lyra-fg-default">{o.name}</span>
                  )}
                  <span className="lyra-body-sm text-lyra-fg-secondary"> · {o.meta}</span>
                </span>
                <span className="shrink-0 lyra-body-sm text-lyra-fg-default">{o.right}</span>
              </li>
            );
          })}
        </ul>
      </div>
  );
}

export function LucasThomasPurchaseHistoryPanelBody({ onOpenOrder }: { onOpenOrder?: (orderId: LucasThomasOrderId) => void }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="lyra-body-md text-lyra-fg-secondary">
        Pre-orders launch editions. 5 orders on file — the Aurora X2 launch order is on hold after card payments failed.
      </p>
      <LucasThomasPurchasesSection onOpenOrder={onOpenOrder} />
    </div>
  );
}

export function LucasThomasMemoryPanelBody({
  focus,
  onOpenOrder,
}: {
  focus: LucasThomasMemoryFocus;
  onOpenOrder?: (orderId: LucasThomasOrderId) => void;
}) {
  const focusedId = FOCUS_TO_ITEM[focus];
  const [openIds, setOpenIds] = React.useState<string[]>(focusedId ? [focusedId] : []);
  React.useEffect(() => {
    setOpenIds(focusedId ? [focusedId] : []);
  }, [focusedId]);
  const tint = (id: string) => (id === focusedId ? "bg-lyra-accent-purple-soft" : undefined);

  const items: AccordionItem[] = [
    {
      id: "card-declined",
      title: "Card declined at checkout",
      subhead: "Web",
      icon: <AlertTriangle className="h-5 w-5 text-lyra-status-warning-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>2:01 PM</TIME>,
      headerClassName: tint("card-declined"),
      content: (
        <p className="lyra-body-md text-lyra-fg-default">
          Visa ending 4417 was declined by the payment service on the Aurora X2 launch order NR-11056 ($189.00).
        </p>
      ),
    },
    {
      id: "link-requested",
      title: "Pay-another-way link requested",
      subhead: "Self-service · The link failed too",
      icon: <MousePointerClick className="h-5 w-5 text-lyra-status-info-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>2:03 PM</TIME>,
      headerClassName: tint("link-requested"),
      content: (
        <p className="lyra-body-md text-lyra-fg-default">
          Lucas asked for a secure pay-another-way link. The PayPal attempt at 2:08 PM was also declined.
        </p>
      ),
    },
    {
      id: "payment-review",
      title: "Payment review · INC-2207",
      subhead: "Back office · Web & Payments · No message sent to Lucas",
      icon: <Clock className="h-5 w-5 text-lyra-accent-purple-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>2:04 PM</TIME>,
      headerClassName: tint("payment-review"),
      content: (
        <ol className="flex flex-col gap-2.5">
          {MEMORY_STEPS.map((step) => (
            <li key={step.n} className="flex items-center gap-2">
              {step.state === "done" ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lyra-status-success-strong text-white">
                  <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                </span>
              ) : (
                <span
                  className={
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border lyra-body-xs " +
                    (step.state === "current"
                      ? "border-lyra-status-warning-strong text-lyra-status-warning-strong"
                      : "border-lyra-border-subtle text-lyra-fg-secondary")
                  }
                >
                  {step.n}
                </span>
              )}
              <span
                className={
                  "min-w-0 flex-1 lyra-body-md " + (step.state === "todo" ? "text-lyra-fg-secondary" : "text-lyra-fg-default")
                }
              >
                {step.label}
              </span>
              {step.time && <TIME>{step.time}</TIME>}
            </li>
          ))}
        </ol>
      ),
    },
    {
      id: "chat-started",
      title: "Chat started",
      subhead: "Chat",
      icon: <MessageCircle className="h-5 w-5 text-lyra-status-info-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>2:05 PM</TIME>,
      content: <p className="lyra-body-md text-lyra-fg-default">Chat started at 2:05 PM with Checkout AI Agent.</p>,
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="lyra-body-md text-lyra-fg-secondary">
        Pre-orders launch editions. Asked about the Aurora X2 launch date on Sep 26 and tried checkout twice today.
      </p>
      <Accordion type="multiple" variant="contained" values={openIds} onValuesChange={setOpenIds} items={items} />
      <LucasThomasPurchasesSection focus={focus} onOpenOrder={onOpenOrder} />
    </div>
  );
}

/** Experience Memory for Marcus Webb (refund case) — same accordion layout as Lucas's, with his own events. */
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
      content: (
        <p className="lyra-body-md text-lyra-fg-default">
          Marcus ordered Noise-Cancelling Headphones for $200.00. Delivery was confirmed a few days later.
        </p>
      ),
    },
    {
      id: "damage-reported",
      headerClassName: focus === "damage-reported" ? "bg-lyra-accent-purple-soft" : undefined,
      title: "Damage reported",
      subhead: "Phone · Customer reported on delivery",
      icon: <AlertTriangle className="h-5 w-5 text-lyra-status-warning-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>Today</TIME>,
      content: (
        <p className="lyra-body-md text-lyra-fg-default">
          Marcus called to report that the headphones arrived with a cracked ear cup and asked for a refund.
        </p>
      ),
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
                    (step.state === "current"
                      ? "border-lyra-status-warning-strong text-lyra-status-warning-strong"
                      : "border-lyra-border-subtle text-lyra-fg-secondary")
                  }
                >
                  {i + 1}
                </span>
              )}
              <span className={"min-w-0 flex-1 lyra-body-md " + (step.state === "todo" ? "text-lyra-fg-secondary" : "text-lyra-fg-default")}>
                {step.label}
              </span>
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

export function LucasThomasArticlePanelBody() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Field label="Summary">
        When a launch-edition order fails at checkout, the launch price and the customer's unit are held for 24 hours so
        the customer can complete the purchase once payment works.
      </Field>
      <Field label="Steps">
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>Confirm the order was not placed and the hold is active.</li>
          <li>Offer a payment method that isn't affected by the incident (for example PayPal on file).</li>
          <li>If it exceeds the AI agent's authorization limit, request an exception from an agent.</li>
          <li>Place the order at the held launch price and confirm with the customer.</li>
        </ol>
      </Field>
      <Field label="Applies to">Launch editions · Checkout incidents</Field>
    </div>
  );
}

/** Mock Copilot answers for the questions the chips ask; anything else gets a generic grounded summary. */
function copilotAnswerFor(question: string): { summary: string; points: string[] } {
  const q = question.toLowerCase();
  if (q.includes("purchase history")) {
    return {
      summary: "Lucas has 3 completed orders in the last 60 days, all paid, and one open order that has not been placed.",
      points: [
        "NR-10982 · Sep 26 · $64.00 · PayPal · Delivered",
        "NR-10871 · Sep 9 · $32.50 · PayPal · Delivered",
        "NR-10790 · Aug 21 · $118.00 · Visa ending 4417 · Delivered",
        "NR-11056 · Today · $189.00 · Aurora X2 launch edition · Not placed (payment declined)",
        "Lifetime spend: $214.50 across 3 orders; no returns or disputes.",
      ],
    };
  }
  if (q.includes("preferences")) {
    return {
      summary: "Lucas prefers PayPal and has used it on 2 of his last 3 orders.",
      points: [
        "Visa ending 4417 was declined twice today and is the likely cause of the failed order.",
        "No split payments: he prefers a single charge.",
        "Contact preference: chat first, email for receipts.",
      ],
    };
  }
  if (q.includes("ai agent try") || q.includes("ai agent")) {
    return {
      summary: "The AI agent tried every automated path before handing off, and did not place the order.",
      points: [
        "Placed NR-11056 on the Visa and retried once: both declined.",
        "Held the $189.00 launch price for 24 hours.",
        "Sent a pay-another-way link; Lucas's PayPal attempt was declined by the payment service.",
        "Requested approval because policy PAY-3.2 needs a person to place a manual order.",
      ],
    };
  }
  if (q.includes("fraud")) {
    return {
      summary: "Low fraud risk (12 / 100). The declines trace to the payment incident, not to Lucas.",
      points: [
        "Identity, device, location and order value all passed screening.",
        "Card velocity flagged for review: 2 attempts in 5 minutes.",
        "Recommendation: safe to approve the exception and place the order manually.",
      ],
    };
  }
  return {
    summary: "Here is what Copilot found from the conversation and Lucas's customer record.",
    points: [
      "Lucas wants the Aurora X2 launch edition at the held $189.00 price.",
      "His card was declined twice and the pay-another-way link also failed.",
      "The order is waiting on the agent's approval to be placed manually.",
    ],
  };
}

const DECISION_LABELS: Record<string, string> = {
  accept: "Approve the Exception",
  decline: "Decline the exception",
  other: "Something else",
  copilot: "Ask Copilot",
};

/** Copilot result for a question the agent asked on Marcus Webb's call (chips or free-form). */
export function MarcusWebbCopilotPanelBody({ text, time }: { text: string; time: string }) {
  const q = text.toLowerCase();
  const answer =
    q.includes("summar")
      ? {
          summary: "Marcus called about a $200 refund for noise-cancelling headphones (order #48213) that arrived with a cracked ear cup.",
          points: [
            "The AI agent verified the order and confirmed the damage report.",
            "The refund qualifies but exceeds the AI agent's $100 auto-approval limit.",
            "Marcus agreed to hold while a person reviews it.",
          ],
        }
      : q.includes("purchase history")
      ? {
          summary: "Marcus has 10 orders in the last 12 months, 5 of them with damage claims.",
          points: [
            "#48213 · Noise-cancelling headphones · $200.00 · Delivered, damage reported",
            "Lifetime spend: $1,184.00 across 10 orders.",
            "5 damaged-product claims in the last 10 transactions.",
          ],
        }
      : q.includes("ai agent")
      ? {
          summary: "The Cognigy AI Agent did everything within its authority before escalating.",
          points: [
            "Verified order #48213 and the $200.00 price.",
            "Confirmed the cracked ear cup and that the refund qualifies.",
            "Hit the $100 auto-approval limit and put Marcus on hold for sign-off.",
          ],
        }
      : {
          summary: "Here is what Copilot found for your question about Marcus's refund.",
          points: ["The $200 refund qualifies under the return policy.", "It needs a person's approval because it exceeds $100."],
        };
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2 rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-surface-base p-3">
        <p className="flex items-center gap-1.5 lyra-body-sm-emphasis text-lyra-accent-purple-strong">
          <Sparkles className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Copilot result
        </p>
        <p className="lyra-body-md text-lyra-fg-default">{answer.summary}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 lyra-body-md text-lyra-fg-default">
          {answer.points.map((pt) => (
            <li key={pt}>{pt}</li>
          ))}
        </ul>
      </div>
      <Field label="Instruction">{text}</Field>
      <Field label="Sent">{time} · by John Smith</Field>
      <Field label="Sent to">Copilot</Field>
      <Field label="Status">
        <Badge shape="pill" color="success" variant="subtle" fontSize={12}>
          Answered
        </Badge>
      </Field>
    </div>
  );
}

export function LucasThomasInstructionPanelBody({ decision, text, time }: { decision: string; text: string; time: string }) {
  const isCopilot = decision === "copilot";
  const answer = isCopilot ? copilotAnswerFor(text) : null;
  return (
    <div className="flex flex-col gap-4 p-4">
      {answer && (
        <div className="flex flex-col gap-2 rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-surface-base p-3">
          <p className="flex items-center gap-1.5 lyra-body-sm-emphasis text-lyra-accent-purple-strong">
            <Sparkles className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Copilot result
          </p>
          <p className="lyra-body-md text-lyra-fg-default">{answer.summary}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 lyra-body-md text-lyra-fg-default">
            {answer.points.map((pt) => (
              <li key={pt}>{pt}</li>
            ))}
          </ul>
        </div>
      )}
      <Field label="Instruction">{text}</Field>
      {!isCopilot && <Field label="Decision">{DECISION_LABELS[decision] ?? decision}</Field>}
      <Field label="Sent">{time} · by John Smith</Field>
      <Field label="Sent to">{isCopilot ? "Copilot" : "Checkout AI Agent"}</Field>
      <Field label="Status">
        <Badge shape="pill" color="success" variant="subtle" fontSize={12}>
          {isCopilot ? "Answered" : "Finished"}
        </Badge>
      </Field>
    </div>
  );
}

function Row({ left, right, sub }: { left: string; right?: React.ReactNode; sub?: string }) {
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="lyra-body-md text-lyra-fg-default">{left}</p>
        {sub && <p className="lyra-body-sm text-lyra-fg-secondary">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </li>
  );
}

function RowList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex flex-col divide-y divide-lyra-border-subtle rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-surface-base">
      {children}
    </ul>
  );
}

// Pill colors have no "neutral" (that is a circle-shape variant); "slate" is the gray.
const pill = (color: Extract<BadgeColor, "success" | "critical" | "warning" | "slate">, text: string) => (
  <Badge shape="pill" color={color} variant="subtle" fontSize={12}>
    {text}
  </Badge>
);

export function LucasThomasFraudPanelBody() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="lyra-body-md text-lyra-fg-secondary">
        Screening ran on all three attempts for NR-11056. No fraud signals were found; the declines trace to the
        payment incident, not to Lucas.
      </p>
      <Field label="Overall risk">{pill("success", "Low · score 12 / 100")}</Field>
      <RowList>
        <Row left="Identity match" sub="Name, email and billing address match the customer record" right={pill("success", "Pass")} />
        <Row left="Device and location" sub="Known device · same city as the last 3 orders" right={pill("success", "Pass")} />
        <Row left="Card velocity" sub="2 attempts in 5 minutes on Visa ending 4417" right={pill("warning", "Review")} />
        <Row left="Issuer response" sub="Soft decline 05 · gateway timeout during INC-2207" right={pill("warning", "Incident")} />
        <Row left="Order value" sub="$189.00 · within his usual range" right={pill("success", "Pass")} />
      </RowList>
      <Field label="Recommendation">Safe to approve the exception and place the order manually.</Field>
    </div>
  );
}

export function LucasThomasPreferencesPanelBody() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Field label="Preferred method">PayPal · used on 2 of the last 3 orders</Field>
      <RowList>
        <Row left="PayPal" sub="lucas.thomas@example.com · last used Sep 26" right={pill("success", "Preferred")} />
        <Row left="Visa ending 4417" sub="Expires 08/28 · declined twice today" right={pill("critical", "Declined")} />
        <Row left="Apple Pay" sub="Not set up" right={pill("slate", "Unused")} />
      </RowList>
      <Field label="Billing address">48 Harbor Lane, Portland, OR 97205</Field>
      <Field label="Contact preference">Chat first · email for receipts</Field>
      <Field label="Saved note">Prefers a single charge, no split payments.</Field>
    </div>
  );
}

export function LucasThomasAiAttemptsPanelBody() {
  const steps: { time: string; title: string; detail: string; status: React.ReactNode }[] = [
    { time: "2:01 PM", title: "Placed order NR-11056", detail: "Visa ending 4417 · $189.00", status: pill("critical", "Declined") },
    { time: "2:03 PM", title: "Retried the card", detail: "Same card, after confirming details with Lucas", status: pill("critical", "Declined") },
    { time: "2:04 PM", title: "Held the launch price", detail: "24 h hold so Lucas keeps $189.00", status: pill("success", "Done") },
    { time: "2:06 PM", title: "Sent a pay-another-way link", detail: "Secure link in chat", status: pill("success", "Sent") },
    { time: "2:08 PM", title: "Lucas paid with PayPal", detail: "Declined by the payment service", status: pill("critical", "Declined") },
    { time: "2:09 PM", title: "Requested approval", detail: "Policy PAY-3.2 needs a person to approve a manual order", status: pill("warning", "Waiting") },
  ];
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="lyra-body-md text-lyra-fg-secondary">
        The AI agent tried every automated path before handing off. It did not place the order or change any payment
        settings.
      </p>
      <RowList>
        {steps.map((st) => (
          <Row key={st.time + st.title} left={st.title} sub={`${st.time} · ${st.detail}`} right={st.status} />
        ))}
      </RowList>
    </div>
  );
}

export function LucasThomasShippingPanelBody() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="lyra-body-md text-lyra-fg-secondary">
        Lucas asked whether order NR-11056 will still ship today, because it is a birthday present for Friday.
      </p>
      <RowList>
        <Row left="Order processing" sub="Payment confirmed · picked and packed" right={pill("success", "Processed")} />
        <Row left="Ships" sub="Leaves the warehouse today before the 4 PM cutoff" right={pill("success", "Today")} />
        <Row left="Standard shipping" sub="Included · 3–5 business days · arrives Monday" right={pill("critical", "Misses Friday")} />
        <Row left="Priority shipping" sub="2 business days · arrives Thursday · +$15.00" right={pill("success", "Arrives by Friday")} />
      </RowList>
      <Field label="Finding">
        The order ships today, but with standard shipping it will not arrive by Friday. Priority shipping is the only
        option that makes it, for an additional $15.00.
      </Field>
      <Field label="Next step">The AI agent offered Lucas the priority upgrade in chat.</Field>
    </div>
  );
}

/** Experience Memory for Tom Lewis's cold call about a duplicate charge (events from the demo's CASE-30409). */
export function TomLewisCallMemoryPanelBody() {
  const [openIds, setOpenIds] = React.useState<string[]>(["charged-twice"]);
  const items: AccordionItem[] = [
    {
      id: "charged-twice",
      title: "Charged twice at checkout",
      subhead: "Web · Order NR-50877",
      icon: <AlertTriangle className="h-5 w-5 text-lyra-status-warning-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>9:12 AM</TIME>,
      content: (
        <p className="lyra-body-md text-lyra-fg-default">
          Order NR-50877 was charged $86.40 twice: once on Visa 2210 and once on Mastercard 9031. Only one order was placed.
        </p>
      ),
    },
    {
      id: "refund-requested",
      title: "Refund requested in the app",
      subhead: "App · Tom Lewis",
      icon: <MousePointerClick className="h-5 w-5 text-lyra-status-info-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>10:40 AM</TIME>,
      content: <p className="lyra-body-md text-lyra-fg-default">Tom asked for the extra charge to be refunded from the order screen.</p>,
    },
    {
      id: "duplicate-review",
      title: "Duplicate-charge review",
      subhead: "Payments · stage 3 of 5",
      icon: <Clock className="h-5 w-5 text-lyra-accent-purple-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>Today</TIME>,
      content: <p className="lyra-body-md text-lyra-fg-default">Waiting on a person to decide which of the two charges is voided.</p>,
    },
    {
      id: "call-started",
      title: "Call started",
      subhead: "Voice · Billing",
      icon: <Phone className="h-5 w-5 text-lyra-status-info-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>2:14 PM</TIME>,
      content: <p className="lyra-body-md text-lyra-fg-default">Tom called in directly and asked to void one of the two charges.</p>,
    },
  ];
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="lyra-body-md text-lyra-fg-secondary">
        Member since 2021 with 3 orders. Prefers voice and asked for a person on his last 2 calls. Made Mastercard 9031 his default card on Sep 27.
      </p>
      <Accordion type="multiple" variant="contained" values={openIds} onValuesChange={setOpenIds} items={items} />
    </div>
  );
}

export type TomLewisCallPanelKey = "order" | "card" | "void-steps" | "maya-order" | "maya-card" | "maya-refund-steps";

export const TOM_LEWIS_CALL_PANEL_TITLES: Record<TomLewisCallPanelKey, { title: string; subhead: string }> = {
  order: { title: "Order NR-50877", subhead: "Tom Lewis · placed 9:12 AM" },
  card: { title: "Mastercard 9031", subhead: "Card on file · Tom Lewis" },
  "void-steps": { title: "Voiding a duplicate charge", subhead: "Billing · how-to" },
  "maya-order": { title: "Order NR-10871", subhead: "Maya Chen · placed Sep 25" },
  "maya-card": { title: "Visa 4417", subhead: "Card on file · Maya Chen" },
  "maya-refund-steps": { title: "Refunding a damaged item", subhead: "Returns · RET-1.3" },
};

/** Slide-out bodies for the links in Tom Lewis's cold-call Autosummary. Mock data only. */
export function TomLewisCallPanelBody({ panel }: { panel: TomLewisCallPanelKey }) {
  if (panel === "maya-order") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Field label="Order">NR-10871 · placed Sep 25</Field>
        <Field label="Item">Espresso machine · qty 1</Field>
        <Field label="Order total">$412.00</Field>
        <Field label="Damage">Cracked water tank · photo check passed</Field>
        <Field label="Refund review">Back office · Returns · stage 3 of 5 · waiting on a person's approval</Field>
        <Field label="Other recent order">Milk frother · NR-10544 · Jun 18 · $49.00</Field>
      </div>
    );
  }
  if (panel === "maya-card") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Field label="Card">Visa ending 4417</Field>
        <Field label="Status">Paid her last 2 orders</Field>
        <Field label="Charge on NR-10871">$412.00 · posted Sep 25</Field>
        <Field label="Refund destination">Refund goes back to Visa 4417</Field>
      </div>
    );
  }
  if (panel === "maya-refund-steps") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Field label="When to use">An item arrived damaged and the customer wants a refund instead of a replacement (RET-1.3).</Field>
        <Field label="Steps">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>Confirm the order number and open the damage photo.</li>
            <li>Check the photo check passed and the refund is within your limit.</li>
            <li>Offer the replacement once, then confirm the customer wants a refund.</li>
            <li>Refund the original card and email the prepaid return label.</li>
            <li>Tell the customer the refund usually posts in 3 to 5 business days.</li>
          </ol>
        </Field>
        <Field label="Your limit">Refunds up to $500 with a confirmed photo check</Field>
      </div>
    );
  }
  if (panel === "order") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Field label="Order">NR-50877 · placed once, today at 9:12 AM</Field>
        <Field label="Item">Trailhead Daypack · qty 1</Field>
        <Field label="Order total">$86.40 ($79.00 item + $7.40 shipping)</Field>
        <Field label="Charges found">
          <ul className="flex flex-col gap-1.5">
            <li className="flex items-center justify-between gap-3">
              <span>$86.40 · Visa 2210</span>
              <Badge shape="pill" color="warning" variant="subtle" fontSize={12}>
                Duplicate
              </Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>$86.40 · Mastercard 9031</span>
              <Badge shape="pill" color="success" variant="subtle" fontSize={12}>
                Keep
              </Badge>
            </li>
          </ul>
        </Field>
        <Field label="Duplicate-charge review">Stage 3 of 5 · waiting on a person to decide which charge is voided</Field>
      </div>
    );
  }
  if (panel === "void-steps") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Field label="When to use">One order was charged twice, on the same or different cards, and the customer wants one charge reversed.</Field>
        <Field label="Steps">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>Confirm the order number and that only one order was placed.</li>
            <li>Match both charges to the order in payments and check that neither has settled.</li>
            <li>Ask which card the customer wants to keep (Tom prefers Mastercard 9031).</li>
            <li>Void the other authorization and note the order.</li>
            <li>Tell the customer the hold usually drops in 3 to 5 business days.</li>
          </ol>
        </Field>
        <Field label="Approval">A person approves voids when the two charges are on different cards.</Field>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 p-4">
      <Field label="Card">Mastercard ending 9031</Field>
      <Field label="Status">Default card since Sep 27</Field>
      <Field label="Charge on NR-50877">$86.40 · posted 9:12 AM</Field>
      <Field label="Other card on file">
        Visa ending 2210 · also charged $86.40 for NR-50877 (the duplicate)
      </Field>
      <Field label="Customer preference">Tom would rather keep the Mastercard 9031 charge and void the Visa 2210 one.</Field>
    </div>
  );
}

/** Experience Memory tab body for Maya Chen's cold call. */
export function MayaChenCallMemoryPanelBody() {
  const [openIds, setOpenIds] = React.useState<string[]>(["return-failed"]);
  const items: AccordionItem[] = [
    {
      id: "return-failed",
      title: "Return failed in the app",
      subhead: "App · Order NR-10871",
      icon: <AlertTriangle className="h-5 w-5 text-lyra-status-warning-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>1:58 PM</TIME>,
      content: <p className="lyra-body-md text-lyra-fg-default">Maya tried to start a return for the cracked espresso machine and it failed.</p>,
    },
    {
      id: "return-submitted",
      title: "Return request submitted",
      subhead: "App · Maya Chen",
      icon: <MousePointerClick className="h-5 w-5 text-lyra-status-info-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>1:59 PM</TIME>,
      content: <p className="lyra-body-md text-lyra-fg-default">She resubmitted the request with a photo of the cracked water tank.</p>,
    },
    {
      id: "refund-review",
      title: "Refund review",
      subhead: "Returns · stage 3 of 5",
      icon: <Clock className="h-5 w-5 text-lyra-accent-purple-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>Today</TIME>,
      content: <p className="lyra-body-md text-lyra-fg-default">Photo verified. Waiting on a person's approval for the $412.00 refund.</p>,
    },
    {
      id: "call-started",
      title: "Call started",
      subhead: "Voice · Returns",
      icon: <Phone className="h-5 w-5 text-lyra-status-info-strong" strokeWidth={1.5} aria-hidden="true" />,
      endSlot: <TIME>2:14 PM</TIME>,
      content: <p className="lyra-body-md text-lyra-fg-default">Maya called in directly and asked for a refund instead of a replacement.</p>,
    },
  ];
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="lyra-body-md text-lyra-fg-secondary">
        Member since 2022 with 6 orders. First damage claim in 2 years. Rated her last 3 contacts 5 of 5 and paid with Visa 4417 on her last 2 orders.
      </p>
      <Accordion type="multiple" variant="contained" values={openIds} onValuesChange={setOpenIds} items={items} />
    </div>
  );
}
