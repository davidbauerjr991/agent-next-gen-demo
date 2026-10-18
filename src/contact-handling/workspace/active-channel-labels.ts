// Module helpers for the agent workspace's record header and Contact Details
// (P-EXTRACT C8a, from AgentWorkspaceAdvancedPage.tsx): the prior-case match,
// and the active channel's / the interaction's date labels.
import type { ChannelType } from "@nicecxone/lyra-ui";
import type { CustomerPriorContactInfo } from "@/components/agent-next-gen-shared-utils";
import { TRANSCRIPT_SESSIONS, TRANSCRIPT_SESSIONS_VOICE, TRANSCRIPT_SESSIONS_EMAIL } from "@/components/transcript/transcript-fixtures";
import type { Thread, Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import { type ContactHistoryEntry, CONTACT_HISTORY } from "@/components/agent-next-gen-contact-history";

/** Bare digits only — used to match a dialed/SMS'd phone number against
 *  `ContactHistoryEntry.phone` regardless of formatting (parens/dashes/
 *  spaces/country code). Ported from `AgentNextGenPage.tsx` ("Phase 1") for
 *  `findContactHistoryMatch`, below — see that function's own doc comment. */

function digitsOnly(value: string | undefined | null): string {
  return (value || "").replace(/\D/g, "");
}

/** Finds the real `CONTACT_HISTORY` case (agent-next-gen-contact-
 *  history.tsx) matching the active interaction, if any — grounds the
 *  Customer Context Overview's content in the customer's ACTUAL prior case
 *  instead of the generic hashed-pool fallback. Ported verbatim from
 *  `AgentNextGenPage.tsx` ("Phase 1") per explicit request to mirror that
 *  page's Customer Context Overview functionality here. Lives here, not in
 *  agent-next-gen-shared-utils.ts, per that file's own dependency-free rule
 *  (see `buildCustomerContextOverviewInfo`'s `priorContact` doc comment
 *  there).
 *
 *  Matches by phone digits first — `customerName` IS the raw dialed/SMS'd
 *  address itself for an unidentified voice/SMS contact — so this is the
 *  one join key that works across every interaction-launch code path
 *  without a dedicated customer-id thread. Falls back to `customerId`
 *  (when the interaction has a real one) and finally an exact name match,
 *  for a chat contact where `customerName` is an actual name rather than a
 *  phone number. */
export function findContactHistoryMatch(
  customerName: string | undefined,
  customerId?: string
): ContactHistoryEntry | undefined {
  if (!customerName) return undefined;
  const dialedDigits = digitsOnly(customerName);
  if (dialedDigits.length >= 7) {
    const byPhone = CONTACT_HISTORY.find((entry) => entry.phone && digitsOnly(entry.phone) === dialedDigits);
    if (byPhone) return byPhone;
  }
  if (customerId) {
    const byId = CONTACT_HISTORY.find((entry) => entry.customerId === customerId);
    if (byId) return byId;
  }
  return CONTACT_HISTORY.find((entry) => entry.name.toLowerCase() === customerName.toLowerCase());
}

/** Extracts the plain fields `buildCustomerContextOverviewInfo` actually
 *  needs (its own `CustomerPriorContactInfo` param) off a matched
 *  `ContactHistoryEntry` — the entry's LAST transcript message (whichever
 *  side spoke last) or, for an email-only case, its `emailBody`, stands in
 *  for `transcriptExcerpt`. Ported verbatim from `AgentNextGenPage.tsx`
 *  ("Phase 1"). */
export function extractPriorContactInfo(entry: ContactHistoryEntry | undefined): CustomerPriorContactInfo | undefined {
  if (!entry) return undefined;
  const lastMessage = entry.messages && entry.messages.length > 0 ? entry.messages[entry.messages.length - 1] : undefined;
  return {
    description: entry.description,
    skillName: entry.skillName,
    statusLabel: entry.statusLabel,
    transcriptExcerpt: lastMessage?.text ?? entry.emailBody,
  };
}

/** Duplicated verbatim from AgentNextGenPage.tsx (Agent Workspace 2.0) per
 *  this codebase's "no shared sync" convention (see BEHAVIOR.md) — used
 *  ONLY for the unknown-contact record-header subtitle (see the
 *  `resolveActiveChannelDateTimeLabel` doc comment below, and the
 *  `PageHeader`'s `subtitle` render call site further down this file). */
function formatCompactDateTime(input: string | Date): string | undefined {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return undefined;
  const datePart = date.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
  const timePart = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

/** Duplicated verbatim from AgentNextGenPage.tsx (Agent Workspace 2.0) per
 *  this codebase's "no shared sync" convention — see that file's own doc
 *  comment on this same function for the full priority-order rationale.
 *  Used ONLY for the unknown-contact record-header subtitle (this tier's
 *  real-customer subtitle is untouched by this port). */
export function resolveActiveChannelDateTimeLabel(
  channelType: ChannelType | undefined,
  isFreshLaunch: boolean,
  activeChannel: Thread | undefined,
  launchedAt: string | undefined
): string | undefined {
  const reopened = activeChannel?.reopenedContacts?.[activeChannel.reopenedContacts.length - 1];
  if (reopened) {
    return formatCompactDateTime(`${reopened.date} ${reopened.startTime}`);
  }
  if (isFreshLaunch) {
    const isTextChannel = channelType === "chat" || channelType === "sms" || channelType === "whatsapp";
    if (isTextChannel) {
      return launchedAt ? formatCompactDateTime(launchedAt) : "Draft";
    }
    return formatCompactDateTime(new Date());
  }
  const baseSessions =
    channelType === "email"
      ? TRANSCRIPT_SESSIONS_EMAIL
      : channelType === "voice"
        ? TRANSCRIPT_SESSIONS_VOICE
        : channelType === "chat" || channelType === "sms" || channelType === "whatsapp"
          ? TRANSCRIPT_SESSIONS
          : undefined;
  const lastSession = baseSessions?.[baseSessions.length - 1];
  if (!lastSession) return undefined;
  return formatCompactDateTime(`${lastSession.date} ${lastSession.startTime}`);
}

/** Finds the most recent real customer-response timestamp across EVERY
 *  thread on an interaction (not just the active one) and formats it with
 *  `formatCompactDateTime` — feeds the record-header subtitle's
 *  "{N} channels open | Last Customer Response: {date/time}" pattern below,
 *  per explicit follow-up request, shown once 2+ channels are open in place
 *  of the single active channel's own "{icon} {label} | {date}" line (that
 *  line stops meaning much once several channels are live at once — this
 *  answers "when did the customer last actually say something," across
 *  whichever channel that happened on).
 *
 *  Resolution per thread, most authoritative first:
 *  1. `lastCustomerMessageTick` — set the instant a real (or simulated)
 *     customer reply lands on THIS session (`handleSendMessage`'s reply
 *     timeout). It's a `clockTick` value — real elapsed seconds since this
 *     page mounted (the page clock's 1-per-second tick, see `clock`'s doc
 *     comment in the page) — so `pageMountTimeMs + tick * 1000` gives
 *     an exact, real wall-clock `Date`, not a mock string.
 *  2. `reopenedContacts` — a thread reopened from Contact History carries a
 *     real historical date/time of its own even with no live reply yet.
 *  3. A genuinely fresh (`interaction.startedFresh`) thread with neither of
 *     the above has had NO customer response at all — skipped outright,
 *     deliberately NOT falling through to canned session data (that would
 *     surface stale, unrelated mock history for a channel the customer
 *     hasn't touched, the same "isFreshLaunch short-circuits before the
 *     canned branch" reasoning `resolveActiveChannelDateTimeLabel` above
 *     already applies).
 *  4. Otherwise (a pre-existing/real customer channel, no live activity
 *     this session) — that channel type's last canned session's own last
 *     CUSTOMER-sender message timestamp (chat/sms/whatsapp only; Voice/
 *     Email's canned sessions ship an empty `messages: []`, so those fall
 *     back to the session's own `startTime`, same as
 *     `resolveActiveChannelDateTimeLabel`'s own base-session fallback).
 *
 *  Returns `undefined` (not a broken "Last Customer Response: undefined"
 *  string) when NONE of the interaction's threads have any qualifying
 *  response yet — the subtitle then reads just "{N} channels open" with no
 *  trailing clause. */
export function resolveInteractionLastCustomerResponseLabel(
  interaction: Interaction,
  pageMountTimeMs: number
): string | undefined {
  let latest: Date | undefined;
  const consider = (candidate: Date | undefined) => {
    if (candidate && !Number.isNaN(candidate.getTime()) && (!latest || candidate.getTime() > latest.getTime())) {
      latest = candidate;
    }
  };
  for (const c of interaction.threads) {
    if (c.lastCustomerMessageTick !== undefined) {
      consider(new Date(pageMountTimeMs + c.lastCustomerMessageTick * 1000));
      continue;
    }
    const reopened = c.reopenedContacts?.[c.reopenedContacts.length - 1];
    if (reopened) {
      consider(new Date(`${reopened.date} ${reopened.startTime}`));
      continue;
    }
    // Per-THREAD, not `interaction.startedFresh` — see `Thread.startedFresh`'s
    // own doc comment. This loop already iterates per-thread (`c`); a
    // genuinely fresh thread (no history to fall back to) skips the canned
    // fallback below regardless of whether the interaction it lives on was
    // itself born fresh or resumed from history.
    if (c.startedFresh) continue;
    const baseSessions =
      c.type === "email"
        ? TRANSCRIPT_SESSIONS_EMAIL
        : c.type === "voice"
          ? TRANSCRIPT_SESSIONS_VOICE
          : c.type === "chat" || c.type === "sms" || c.type === "whatsapp"
            ? TRANSCRIPT_SESSIONS
            : undefined;
    const lastSession = baseSessions?.[baseSessions.length - 1];
    if (!lastSession) continue;
    const lastCustomerMessage = [...lastSession.messages].reverse().find((m) => m.sender === "customer");
    consider(new Date(`${lastSession.date} ${lastCustomerMessage?.timestamp ?? lastSession.startTime}`));
  }
  return latest ? formatCompactDateTime(latest) : undefined;
}
