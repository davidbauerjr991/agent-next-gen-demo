import { CONTACT_HISTORY, type ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import type { ScenarioScript } from "@/scenarios/scenario-script";

/** The Journey Summary card's content (P-CANVAS): the customer's recent
 *  contacts as one summary line and a row per contact, newest first. */
export interface JourneySummaryInfo {
  summary: string;
  rows: { name: string; detail?: string }[];
}

const digitsOnly = (value: string) => value.replace(/\D/g, "");
const firstSentence = (text: string) => text.match(/^[^.!?]*[.!?]/)?.[0] ?? text;

/** Every Contact History row for this customer: by phone (a dialed or
 *  calling number), by customer id, or by name. */
function historyFor(customerName: string | undefined, customerId: string | undefined): ContactHistoryEntry[] {
  if (!customerName && !customerId) return [];
  const digits = customerName ? digitsOnly(customerName) : "";
  const name = customerName?.toLowerCase();
  return CONTACT_HISTORY.filter(
    (entry) =>
      (digits.length >= 7 && !!entry.phone && digitsOnly(entry.phone) === digits) ||
      (!!customerId && entry.customerId === customerId) ||
      (!!name && entry.name.toLowerCase() === name),
  );
}

/** A scripted case's own journey (its script's `content.journey`), else the
 *  customer's Contact History; `null` when there's no history. */
export function journeySummaryFor({
  script,
  customerName,
  customerId,
}: {
  script?: ScenarioScript;
  customerName?: string;
  customerId?: string;
}): JourneySummaryInfo | null {
  const scripted = script?.content.journey;
  if (scripted) return scripted.rows.length > 0 ? { summary: scripted.summary, rows: [...scripted.rows] } : null;
  const history = historyFor(customerName, customerId);
  if (history.length === 0) return null;
  const [latest] = history;
  const summary =
    history.length === 1
      ? `One earlier contact, on ${latest.channelLabel.toLowerCase()}: ${firstSentence(latest.description)}`
      : `${history.length} earlier contacts. The latest, on ${latest.channelLabel.toLowerCase()}: ${firstSentence(latest.description)}`;
  return {
    summary,
    rows: history.map((entry) => ({ name: `${entry.timeAgo} · ${entry.channelLabel}`, detail: firstSentence(entry.description) })),
  };
}
