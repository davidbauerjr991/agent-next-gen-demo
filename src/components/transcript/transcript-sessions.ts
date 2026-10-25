// Which sessions a thread's transcript shows, as a pure function of the
// thread (P-EXTRACT). `InteractionTranscript` renders from it, and the page
// derives a thread's current session from it (`currentSessionOf`) instead of
// waiting for a mounted transcript to report one.
import type { ChannelType } from "@nicecxone/lyra-ui";
import { CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_LAST_NAME } from "@/components/agent-next-gen-shared-utils";
import {
  TRANSCRIPT_SESSION_FINGERPRINT,
  TRANSCRIPT_SESSION_FINGERPRINT_EMAIL,
  TRANSCRIPT_SESSION_FINGERPRINT_VOICE,
  TRANSCRIPT_SESSIONS,
  TRANSCRIPT_SESSIONS_EMAIL,
  TRANSCRIPT_SESSIONS_VOICE,
} from "./transcript-fixtures";
import type { TranscriptSession } from "./transcript-types";

/** One reopen of a closed text thread (`Thread.reopenedContacts`). */
interface ReopenedContactEntry {
  id: string;
  contactId: string;
  date: string;
  startTime: string;
  messagesBeforeReopen?: number;
}

export interface TranscriptSessionsInput {
  channelType?: ChannelType;
  isFreshLaunch?: boolean;
  contactId: string;
  channelAddressLabel?: string;
  skillLabel?: string;
  hideMockFollowUpMessages?: boolean;
  reopenedContacts?: readonly ReopenedContactEntry[];
}

const isTextChannelType = (channelType: ChannelType | undefined) =>
  channelType === "chat" || channelType === "sms" || channelType === "whatsapp";

/** The sessions a thread's transcript renders, oldest first, and their split
 *  into the base log and the reopens (`InteractionTranscript` slices live
 *  messages across them). `now` dates a fresh launch's synthesized session. */
export function deriveTranscriptSessions(input: TranscriptSessionsInput, now: Date = new Date()) {
  const { channelType, isFreshLaunch, contactId, channelAddressLabel, skillLabel, hideMockFollowUpMessages, reopenedContacts } = input;
  // A freshly-launched interaction (see `isFreshLaunch`'s own doc comment)
  // shows just a single synthesized "Session Details" separator (today's
  // date, this Thread's own base contactId/skill, status "Open") in place
  // of the fixed `TRANSCRIPT_SESSIONS`/`_VOICE`/`_EMAIL` mock log — a
  // brand-new interaction genuinely has no history yet AND hasn't been
  // worked/resolved yet either.
  //
  // Originally only SMS got this (per an earlier, narrower request); Chat/
  // WhatsApp fell through to the shared mock log even when freshly
  // launched (the "brand-new WhatsApp shows a full, pre-existing
  // conversation" bug reported from a screenshot of a New Outbound
  // WhatsApp launch), so this was widened to cover all three text
  // channels. Voice/Email were deliberately left OUT of that widening at
  // the time — their own fixed mock session has no message log to wrongly
  // show in the first place (`messages: []` either way), so the "fake
  // history" bug this fix targeted genuinely didn't apply to them — but
  // that same fixed mock's `status` field is hardcoded `"Resolved"` (see
  // `TRANSCRIPT_SESSIONS_VOICE`/`_EMAIL`'s own doc comments), which is
  // exactly wrong for a call/email that just started: per explicit bug
  // report ("new interactions should have an 'open' status to start"), a
  // brand-new Voice/Email thread was showing "Resolved" in its own
  // Session Details pill before the agent had done anything at all. Voice/
  // Email now go through this same synthesized-session branch for that
  // reason — the "no history" framing happens to apply to them for free
  // (their synthesized session's `messages` is `[]`, identical to what
  // their static mock already used), and the status/date/time now
  // correctly reflect "just started" instead of a stale, already-resolved
  // mock call from months ago. `liveMessages` (real, sent-this-visit
  // messages) renders in its own trailing block right after whichever of
  // the two this resolves to — see `InteractionTranscript`'s render.
  const isTextChannel = isTextChannelType(channelType);
  // The synthesized fresh session's own "Channel" field (Session Details'
  // Contact ID/Date/.../Channel/Skill row) should read as whichever
  // channel was actually launched, not a hardcoded "SMS" now that this
  // covers every channel type, not just the three text ones.
  const freshSessionChannelLabel =
    channelType === "whatsapp"
      ? "WhatsApp"
      : channelType === "chat"
      ? "Chat"
      : channelType === "sms"
      ? "SMS"
      : channelType === "voice"
      ? "Voice"
      : "Email";
  // Same per-channel-family fingerprint the static `TRANSCRIPT_SESSIONS_VOICE`/
  // `_EMAIL` mocks already use for a RESUMED call/email (see each one's own
  // doc comment) — reused here so a freshly-launched one's synthesized
  // session shows the same plausible device metadata instead of falling
  // back to chat's fingerprint just because it's built in this shared
  // branch now.
  const freshSessionFingerprint =
    channelType === "voice"
      ? TRANSCRIPT_SESSION_FINGERPRINT_VOICE
      : channelType === "email"
      ? TRANSCRIPT_SESSION_FINGERPRINT_EMAIL
      : TRANSCRIPT_SESSION_FINGERPRINT;
  // Voice/Email's own (non-fresh) session arrays (see `TRANSCRIPT_SESSIONS_VOICE`/
  // `TRANSCRIPT_SESSIONS_EMAIL`'s own doc comments) rather than falling
  // through to chat's `TRANSCRIPT_SESSIONS` — every channel type shows
  // session info, but a call or an email shouldn't be mislabeled "SMS" in
  // its own Session Details panel just because it fell into the same
  // default branch.
  const loggedSessions: TranscriptSession[] = isFreshLaunch
    ? [
        {
          id: "session-fresh",
          contactId,
          addressLabel: channelAddressLabel,
          date: now.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
          startTime: now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
          endTime: "—",
          channel: freshSessionChannelLabel,
          skill: skillLabel ?? "—",
          agent: `${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`,
          status: "Open",
          fingerprint: freshSessionFingerprint,
          messages: [],
        },
      ]
    : channelType === "voice"
    ? TRANSCRIPT_SESSIONS_VOICE
    : channelType === "email"
    ? TRANSCRIPT_SESSIONS_EMAIL
    : hideMockFollowUpMessages
    ? TRANSCRIPT_SESSIONS.map((sess) => (sess.id === "session-2" ? { ...sess, messages: [] } : sess))
    : TRANSCRIPT_SESSIONS;
  // The shared chat log is mocked as an SMS thread; a text thread's sessions name the thread's own channel (one label
  // source, the channel type), so Lucas's chat reads "Chat" in every layout.
  const baseSessions: TranscriptSession[] = isTextChannel
    ? loggedSessions.map((s) => (s.channel === freshSessionChannelLabel ? s : { ...s, channel: freshSessionChannelLabel }))
    : loggedSessions;
  // One more synthetic, empty "Session Details" separator per reopen — see
  // `reopenedContacts`' own doc comment (`InteractionTranscript`). Same
  // synthetic shape as `session-fresh` above, just built from the reopen's
  // own captured date/time (`reopenedContacts` entries) instead of "now"
  // and keyed by that entry's own id rather than the fixed
  // `"session-fresh"` one, so several reopens on the same channel each
  // render as their own distinct row instead of colliding on id. Text
  // channels only — voice/email have no multi-session "reopen" concept to
  // extend here (their `reopenedContacts` prop is always `undefined` in
  // practice, but `isTextChannel` guards this regardless), unlike
  // `baseSessions` above, which now covers every channel type for the
  // "fresh launch" case.
  const reopenedSessions: TranscriptSession[] = isTextChannel
    ? (reopenedContacts ?? []).map((entry) => ({
        id: entry.id,
        contactId: entry.contactId,
        // Same live channel, just reopened — reuses the one active
        // `channelAddressLabel` rather than needing its own per-reopen
        // value (`reopenedContacts` entries carry no address of their
        // own; see this field's own doc comment on `TranscriptSession`).
        addressLabel: channelAddressLabel,
        date: entry.date,
        startTime: entry.startTime,
        endTime: "—",
        channel: freshSessionChannelLabel,
        skill: skillLabel ?? "—",
        agent: `${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`,
        status: "Open",
        fingerprint: TRANSCRIPT_SESSION_FINGERPRINT,
        messages: [],
      }))
    : [];
  const sessions: TranscriptSession[] = [...baseSessions, ...reopenedSessions];
  // The "current" session for status purposes — see `currentStatus`/
  // `onCurrentStatusChange`'s own doc comments (`InteractionTranscript`).
  // Always the most RECENT reopen (if any) rather than always
  // `baseSessions`' own last entry — reopening should hand "current" over
  // to the brand-new session, not leave it pointed at the old closed one.
  const lastSessionId = sessions[sessions.length - 1]?.id;
  return { isTextChannel, baseSessions, reopenedSessions, sessions, lastSessionId };
}

/** A session's status as its row shows it: the current session's is the
 *  thread's (`currentStatus`), every earlier one reads "Closed". */
export function sessionStatusOf(session: TranscriptSession, lastSessionId: string | undefined, currentStatus: string | undefined) {
  return session.id === lastSessionId ? currentStatus ?? session.status : "Closed";
}

/** A thread's current session, with its status: what Contact Details'
 *  Session tab shows when no session was picked. */
export function currentSessionOf(input: TranscriptSessionsInput & { currentStatus?: string }, now?: Date): TranscriptSession | null {
  const { sessions, lastSessionId } = deriveTranscriptSessions(input, now);
  const current = sessions.find((session) => session.id === lastSessionId);
  return current ? { ...current, status: sessionStatusOf(current, lastSessionId, input.currentStatus) } : null;
}
