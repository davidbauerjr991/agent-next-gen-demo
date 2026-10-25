// The customer record each AI-led case seeds (PLAN.md "AI-led cases"): one
// address, a balance and a latest interaction that fit the scenario. Contact
// Details, the Latest Interaction card and the case's panels all read it, so
// the header and Contact Details never disagree. Keyed by the case's customer
// record id (its script's `entity.caseId`); a customer with no entry keeps the
// synthesized profile.

export interface CaseCustomerRecord {
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  balance: string;
  latestInteraction: {
    timeAgo: string;
    channel: string;
    status: string;
    statusVariant: "critical" | "info" | "warning" | "success" | "neutral";
    summary: string;
    caseId: string;
    handledBy: string;
  };
}

export const CASE_CUSTOMER_RECORDS: Readonly<Record<string, CaseCustomerRecord>> = {
  // Marcus Webb: the $200 refund the bot can't approve is owed to him until it's settled.
  "MW-DEMO-0001": {
    address1: "412 Birchwood Lane",
    city: "Springfield",
    state: "IL",
    postalCode: "62704",
    balance: "$0.00",
    // His latest transaction is the pending refund credit, so the record reads as a refund case.
    latestInteraction: {
      timeAgo: "Today",
      channel: "Voice",
      status: "Pending",
      statusVariant: "warning",
      summary: "$200.00 refund credit for the cracked headphones (order #48213), pending a person's approval.",
      caseId: "RF-20452",
      handledBy: "Cognigy AI Agent",
    },
  },
  // Lucas Thomas: the Aurora X2 launch order is held at its launch price, unpaid.
  "CASE-30418": {
    address1: "1420 Harbor St, Apt 5B",
    city: "Portland",
    state: "OR",
    postalCode: "97209",
    balance: "$189.00",
    latestInteraction: {
      timeAgo: "2 days ago",
      channel: "Chat",
      status: "Resolved",
      statusVariant: "success",
      summary: "Asked whether the Aurora X2 launch price would hold for his order. Confirmed the price and added his saved card.",
      caseId: "CASE-30391",
      handledBy: "Priya Nair",
    },
  },
};

/** One line, as a shipping or billing address reads. */
export const formatCaseAddress = (record: Pick<CaseCustomerRecord, "address1" | "city" | "state" | "postalCode">): string =>
  `${record.address1}, ${record.city}, ${record.state} ${record.postalCode}`;
