import { useState, useEffect } from "react";
import { Input } from "@nicecxone/lyra-ui";
import { Pencil } from "lucide-react";
import { type TranscriptSession } from "@/components/transcript/transcript-types";
import { TranscriptSessionDetails } from "@/components/transcript/session-row/session-row-parts";
import { cn } from "@/lib/utils";
import { CustomerRecordSaveFooter } from "./CustomerDetailTabs";

/* ── useSessionDetailsTabContent ──
   Per explicit request ("make session details its own tab in the view
   details panel"): the "Session Details" content, pulled OUT of
   `DetailsPanelAccordions` below (which used to render it as its own
   default-open `Accordion` item) into its own panel-tab content — each
   page's own "Details"/"Transcript" `headerTabs` row gains a "Session
   Details" tab alongside them (see each page's own render site) rather
   than nesting this inside the "Details" tab's accordion stack.

   A HOOK, not a plain component — same reasoning `useCustomerDetailsInteriorPanel`
   above already documents for itself: per further explicit follow-up
   request ("session detail cancel/save should be fixed to the bottom of
   the panel like in the customer information edits so they never leave
   the view of the user"), Save/Cancel need to render in the CALLER's own
   `SidePanel`'s `footer` slot (outside its scrolling body, so they stay
   pinned/visible at every scroll position) rather than inline at the
   bottom of the scrolling form the way they used to — a plain component
   returning one render tree has no way to split itself across two
   different slots on an element it doesn't own. Returning `{ body, footer
   }` as plain values lets the caller spread `footer` into its existing
   `SidePanel` call's own `footer` prop (only while THIS tab is showing —
   see each page's own render site) and `body` into that tab's content,
   exactly like `useCustomerDetailsInteriorPanel` already does one level up
   for the whole panel. Reuses the exact same `CustomerRecordSaveFooter`
   Save/Cancel footer the Customer Overview/Customer Information edits
   already use, for a visually identical "fixed to the bottom" treatment. */
export function useSessionDetailsTabContent({
  sessionContact,
  onEditClick,
}: {
  /** The actual session "View Details" was clicked on (or the current
   *  in-progress one for voice) — `null` while none has been picked yet
   *  (e.g. the first render or two after the panel mounts, before the
   *  transcript's own `onCurrentSessionChange` has fired even once): `body`
   *  falls back to a plain placeholder and `footer` stays `undefined`
   *  (nothing to save with no session loaded). */
  sessionContact: TranscriptSession | null;
  /** Fired (in addition to this hook's own internal `sessionEditing`
   *  becoming `true`) whenever the Edit button is clicked — for a caller
   *  that renders this hook's `body` in more than one place sharing the
   *  same hook instance (e.g. a docked panel AND a transient hover-preview
   *  popover of it), this is the hook to make sure the right one is
   *  actually visible/open when editing starts, since this hook has no
   *  idea which of its callers' renders the agent clicked "Edit" in. */
  onEditClick?: () => void;
}): { body: React.ReactNode; footer: React.ReactNode } {
  const viewAllLinkClassName = "lyra-body-sm-emphasis text-lyra-status-info-strong text-left hover:underline w-fit";

  // Per explicit request ("make the View All say 'Edit' and when edit is
  // clicked make the session details editable like the customer overview
  // accordion"): same Pencil-icon "Edit" button/vertical-Input-fields idiom
  // the Customer Overview accordion already established
  // (`allowOverviewEdit`/`overviewEditing`'s own render site, this file).
  // Deliberately self-contained LOCAL state here rather than lifted to
  // page-level state the way Customer Overview's `overviewEditing`/
  // `recordDraft` are: unlike a real customer record, a session's own
  // Contact ID/Date/Start/End/Channel/Skill/Agent/Status fields have no
  // backing store anywhere in this app to persist a change to
  // (`TRANSCRIPT_SESSIONS`/`_VOICE`/`_EMAIL`, agent-next-gen-transcript.tsx,
  // are static mock data) — so "Save" just commits the locally-edited draft
  // into this same local state, which the read-only view below renders
  // from too, rather than writing through to any real interaction/session
  // record.
  const [sessionEditing, setSessionEditing] = useState(false);
  const [sessionDraft, setSessionDraft] = useState(sessionContact);
  // The session's identity: its id isn't enough (every fresh launch is
  // "session-fresh", whatever the channel), so a tab switch from a fresh call
  // to a fresh SMS kept showing the call (P-AIFIRST (k6) 8).
  const sessionIdentity = sessionContact ? `${sessionContact.id}|${sessionContact.channel}|${sessionContact.contactId}` : "";
  useEffect(() => {
    setSessionDraft(sessionContact);
    setSessionEditing(false);
    // Keyed on the session's identity, not the whole `sessionContact` object —
    // the caller rebuilds that object fresh on every render (e.g. the
    // `sessionWithCurrentStatus` patch in agent-next-gen-transcript.tsx), so
    // resetting on reference equality alone would wipe out an in-progress
    // edit the instant anything else on the page re-rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdentity]);
  // Same eight fields `TranscriptSessionDetails` itself reads, just as a
  // {key, label} list this loop can walk to build one `Input` per field
  // while editing — `key` is a real `Contact` field name so `sessionDraft[
  // key]`/the `setSessionDraft` updater below stay type-safe without a
  // parallel hand-maintained union.
  const sessionEditFields: Array<{ key: keyof Pick<TranscriptSession, "contactId" | "date" | "startTime" | "endTime" | "channel" | "skill" | "agent" | "status">; label: string }> = [
    { key: "contactId", label: "Contact ID" },
    { key: "date", label: "Date" },
    { key: "startTime", label: "Start" },
    { key: "endTime", label: "End" },
    { key: "channel", label: "Channel" },
    { key: "skill", label: "Skill" },
    { key: "agent", label: "Agent" },
    { key: "status", label: "Status" },
  ];

  if (!sessionContact || !sessionDraft) {
    return {
      body: (
        <p className="lyra-body-md text-lyra-fg-secondary px-4 pt-3 pb-4">
          Select "View Details" on a session to see its details here.
        </p>
      ),
      footer: undefined,
    };
  }

  return {
    body: (
      <div className="flex flex-col gap-3 p-4 overflow-y-auto">
        {/* Hidden while editing — Save/Cancel (now in the panel's own fixed
            footer, not inline here) are the only way back out once editing
            starts. */}
        {!sessionEditing && (
          <button
            type="button"
            className={cn(viewAllLinkClassName, "inline-flex items-center gap-1.5")}
            onClick={() => {
              setSessionEditing(true);
              onEditClick?.();
            }}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            Edit
          </button>
        )}
        {sessionEditing ? (
          <div className="flex flex-col gap-3">
            {/* Standard, vertical (label-above-field) form fields — same
                layout switch Customer Overview's own editing state uses in
                place of its read-only "label left, value right" row (see
                that accordion's own doc comment on `overviewEditing`). */}
            {sessionEditFields.map(({ key, label }) => (
              <Input
                key={key}
                label={label}
                value={sessionDraft[key]}
                onChange={(e) => setSessionDraft((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))}
              />
            ))}
          </div>
        ) : (
          <TranscriptSessionDetails session={sessionDraft} plain />
        )}
      </div>
    ),
    footer: sessionEditing ? (
      <CustomerRecordSaveFooter
        onSave={() => setSessionEditing(false)}
        onCancel={() => {
          setSessionDraft(sessionContact);
          setSessionEditing(false);
        }}
      />
    ) : undefined,
  };
}
