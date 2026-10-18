// The transcript's per-session controls (P-EXTRACT: split out of `InteractionTranscript`, unchanged): the mock
// log's message/tag state, live-message tags, collapsed sessions and the status popover.
import { useEffect, useRef, useState } from "react";
import { TRANSCRIPT_SESSIONS } from "./transcript-fixtures";
import { sessionStatusOf } from "./transcript-sessions";
import type { TranscriptMessage, TranscriptSession, TranscriptTag } from "./transcript-types";

export function useSessionControls({
  contactId,
  sessionsToRender,
  lastSessionId,
  currentStatus,
  onCurrentStatusChange,
  liveMessages,
}: {
  contactId: string;
  sessionsToRender: TranscriptSession[];
  lastSessionId: string | undefined;
  currentStatus: string | undefined;
  onCurrentStatusChange: (status: string) => void;
  liveMessages: TranscriptMessage[];
}) {
  // Local, per-session tag state — removing/adding a tag on one message
  // shouldn't touch any other message's tags (in this session or any
  // other), so this is keyed by session id rather than one flat array.
  const [sessionMessages, setSessionMessages] = useState<Record<string, TranscriptMessage[]>>(() =>
    Object.fromEntries(TRANSCRIPT_SESSIONS.map((s) => [s.id, s.messages]))
  );
  // Ids already present when this transcript first rendered — anything that
  // arrives later (a live/simulated message) slides + fades in, same entrance
  // Marcus Webb's chat uses; the initial history renders without animation.
  const initialMessageIdsRef = useRef<Set<string> | null>(null);
  if (initialMessageIdsRef.current === null) {
    initialMessageIdsRef.current = new Set(liveMessages.map((m) => m.id));
  }
  // Which message's "Add tag" popover is open — at most one at a time,
  // across every session (message ids are already unique per session, so
  // a single id is enough with no session key needed alongside it).
  const [tagPickerOpenId, setTagPickerOpenId] = useState<string | null>(null);

  // Which CLOSED sessions have their message content collapsed away — a
  // per-session `Set`, independent toggles rather than an exclusive
  // accordion, same as the now-removed `openSessionIds` used to be
  // ("View Details" no longer toggles anything in place here — see
  // `TranscriptSessionSeparator`'s own doc comment). This animates this
  // session's own message bubbles (rendered
  // further down, in this session's own per-session block) shut. Only a
  // session that reads "Closed" ever exposes the collapse icon that flips
  // this (`TranscriptSessionSeparator`'s own `onToggleCollapsed` doc
  // comment) — a still-open session's id never lands in this set.
  const [collapsedSessionIds, setCollapsedSessionIds] = useState<Set<string>>(new Set());

  const toggleSessionCollapsed = (sessionId: string) => {
    setCollapsedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  // Per explicit bug fix: a contact with more than one session (multiple
  // past, Closed threads plus the current one) used to load with EVERY
  // session's message content expanded — `collapsedSessionIds` started out
  // empty, so nothing was collapsed until an agent manually clicked one
  // shut. Every session but `lastSessionId` always reads "Closed"
  // (`getSessionStatus`, below), so on a genuinely fresh contact load
  // (`contactId` — this prop identifies the specific channel/thread being
  // viewed, not just the customer) every one of THOSE gets collapsed by
  // default here, leaving only the current session's own messages visible
  // — an agent can still re-expand any of them individually via
  // `toggleSessionCollapsed` same as before, this only changes the
  // starting state. Deliberately NOT included in the dependency array:
  // `sessionsToRender`/`lastSessionId` themselves — this should fire once
  // per contact load, not re-collapse a session the agent just re-expanded
  // simply because a live message arrived and re-triggered a re-render.
  useEffect(() => {
    setCollapsedSessionIds(
      new Set(sessionsToRender.filter((session) => session.id !== lastSessionId).map((session) => session.id))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  // The CURRENT session's status is `currentStatus`, a prop from
  // `Interaction` (see its own doc comment for why) — every OTHER
  // (historical) session in this Thread always reads "Closed", full stop,
  // regardless of whatever its own static `status` field says. Per
  // explicit bug report/fix: this used to fall back to each historical
  // session's own `status` (only forced to "Closed" when it had been
  // specifically superseded by a live reopen) — a real, confirmed bug,
  // since a Thread's fixed mock session data (`TRANSCRIPT_SESSIONS`/
  // `_VOICE`/`_EMAIL`) can have more than one entry that was never
  // authored as "Closed" (e.g. two consecutive "Resolved" rows), which
  // rendered as two simultaneously "open"-looking sessions in one Thread.
  // There should never be more than one non-Closed session in a Thread —
  // only the current one is ever actually live — so this is now a plain
  // position check with no other source to fall back to. The local
  // "freeze any historical session's status via its own popover" override
  // this used to support is gone along with it — see
  // `TranscriptSessionSeparator`'s own `isCurrentSession` doc comment:
  // a historical session's status pill is now always locked, so that
  // popover can never actually open to override anything in the first
  // place.
  // (`sessionStatusOf`, transcript-sessions.ts.) The page reads a thread's
  // current session from the same derivation (`currentSessionOf`), so this
  // transcript reports nothing up (P-EXTRACT: it used to, from an effect,
  // which only worked while it was mounted).
  const getSessionStatus = (session: TranscriptSession) => sessionStatusOf(session, lastSessionId, currentStatus);

  // Which session's status popover is open, and which of that popover's two
  // bodies (the status list, or the "Close Contact?" confirm) it's
  // currently showing — see `TranscriptSessionSeparator`'s own doc comment
  // for why this is one Popover with a swappable body rather than two. At
  // most one open across the whole transcript at a time, same pattern as
  // `tagPickerOpenId` above.
  const [statusMenuOpenId, setStatusMenuOpenId] = useState<string | null>(null);
  const [statusMenuView, setStatusMenuView] = useState<"menu" | "confirm">("menu");

  // Opening (or re-opening) a session's status popover always starts on the
  // list view, never stranded on a stale "confirm" from a previous visit —
  // `onStatusMenuOpenChange(false)` (outside click, Escape, re-clicking the
  // trigger) resets both pieces of state so the next open is always fresh.
  const handleStatusMenuOpenChange = (sessionId: string, open: boolean) => {
    if (open) {
      setStatusMenuView("menu");
      setStatusMenuOpenId(sessionId);
    } else {
      setStatusMenuOpenId(null);
      setStatusMenuView("menu");
    }
  };

  // A non-"Closed" status picked straight from the list — applies right
  // away and closes the popover. "Closed" itself is deliberately not
  // handled here; see `handleConfirmCloseSession` below for why that one
  // status needs a confirm step first. Always routes to
  // `onCurrentStatusChange` (up onto `Interaction`) — per explicit
  // request/bug fix, only the CURRENT session's status pill is ever
  // unlocked at all now (`TranscriptSessionSeparator`'s own
  // `isCurrentSession`/`isClosed`, see that prop's doc comment), so this
  // is never actually reachable for any other (historical) session; no
  // `sessionId` parameter needed to branch on anymore.
  const selectSessionStatus = (status: string) => {
    if (status === "Closed") {
      setStatusMenuView("confirm");
      return;
    }
    onCurrentStatusChange(status);
    setStatusMenuOpenId(null);
  };

  const handleConfirmCloseSession = () => {
    onCurrentStatusChange("Closed");
    setStatusMenuOpenId(null);
    setStatusMenuView("menu");
  };

  const handleCancelCloseSession = () => {
    setStatusMenuOpenId(null);
    setStatusMenuView("menu");
  };

  const removeTag = (sessionId: string, messageId: string, tagId: string) => {
    setSessionMessages((prev) => ({
      ...prev,
      [sessionId]: prev[sessionId].map((m) => (m.id === messageId ? { ...m, tags: m.tags?.filter((t) => t.id !== tagId) } : m)),
    }));
  };

  const clearTags = (sessionId: string, messageId: string) => {
    setSessionMessages((prev) => ({
      ...prev,
      [sessionId]: prev[sessionId].map((m) => (m.id === messageId ? { ...m, tags: [] } : m)),
    }));
  };

  const addTag = (sessionId: string, messageId: string, option: Omit<TranscriptTag, "id">) => {
    setSessionMessages((prev) => ({
      ...prev,
      [sessionId]: prev[sessionId].map((m) =>
        m.id === messageId
          ? { ...m, tags: [...(m.tags ?? []), { ...option, id: `${messageId}-${option.label.toLowerCase()}` }] }
          : m
      ),
    }));
    // Deliberately doesn't close the popover — picking a tag is meant to be
    // a quick multi-select (add Complain, then Help, then close when done),
    // not a one-shot pick. Closing is explicit: the header's close button,
    // or clicking off the popover (Radix's default outside-click handling
    // on `PopoverPrimitive.Content`, unchanged here).
  };

  const copyMessage = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  // Tag state for `liveMessages` (sent/received messages, not the fixed mock
  // log) — kept separate from `sessionMessages` above; see `liveMessages`
  // prop's own doc comment for why. Keyed by message id, same shape as
  // `sessionMessages`' per-message tags, just not nested under a session id
  // since there's only ever one flat live list, not several sessions' worth.
  const [liveMessageTags, setLiveMessageTags] = useState<Record<string, TranscriptTag[]>>({});

  const addLiveTag = (messageId: string, option: Omit<TranscriptTag, "id">) => {
    setLiveMessageTags((prev) => ({
      ...prev,
      [messageId]: [...(prev[messageId] ?? []), { ...option, id: `${messageId}-${option.label.toLowerCase()}` }],
    }));
  };

  const removeLiveTag = (messageId: string, tagId: string) => {
    setLiveMessageTags((prev) => ({
      ...prev,
      [messageId]: (prev[messageId] ?? []).filter((t) => t.id !== tagId),
    }));
  };

  const clearLiveTags = (messageId: string) => {
    setLiveMessageTags((prev) => ({ ...prev, [messageId]: [] }));
  };

  return {
    sessionMessages,
    initialMessageIdsRef,
    tagPickerOpenId,
    setTagPickerOpenId,
    collapsedSessionIds,
    toggleSessionCollapsed,
    getSessionStatus,
    statusMenuOpenId,
    statusMenuView,
    handleStatusMenuOpenChange,
    selectSessionStatus,
    handleConfirmCloseSession,
    handleCancelCloseSession,
    removeTag,
    clearTags,
    addTag,
    copyMessage,
    liveMessageTags,
    addLiveTag,
    removeLiveTag,
    clearLiveTags,
  };
}
