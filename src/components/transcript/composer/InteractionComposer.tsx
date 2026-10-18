// The message composer (P-EXTRACT: split out of agent-next-gen-transcript.tsx, unchanged).
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ActionIconButton,
  Button,
  InlineNotification,
  QuickReplyMenu,
  QuickReplyVariableForm,
  Switch,
  Textarea,
  ToggleGroup,
  type QuickReplyMenuItem,
} from "@nicecxone/lyra-ui";
import { Bold, ChevronDown, FileText, Italic, Paperclip, Send, Smile, Zap } from "lucide-react";
import { CopilotComposer } from "@/components/copilot-composer";
import { ComposerFade } from "./ComposerFade";
import {
  QUICK_REPLIES,
  QUICK_REPLY_TRIGGER_CHAR,
  QUICK_REPLY_TRIGGER_PATTERN,
  fillQuickReplyTemplate,
  type QuickReplyItem,
} from "./quick-replies";

/* ── InteractionComposer ──
   The message-input bar fixed to the bottom of an active interaction's
   detail page — a sibling rendered right after `InteractionTranscript`
   rather than living inside it, so it's a `shrink-0` row in the same flex
   column instead of scrolling away with the transcript above it (which is
   the `flex-1 overflow-y-auto` element doing all the scrolling).

   Composed from existing lyra-ui exports (`Textarea`, `Button`,
   `ActionIconButton`) plus the two new `QuickReplyMenu`/
   `QuickReplyVariableForm` exports for the "/trigger" quick-reply picker
   (see the "Quick replies" data block, quick-replies.ts). The "Send ▾"
   control is hand-built from two adjacent `Button`s (rounded-r-none /
   rounded-l-none, a hairline divider between) since lyra-ui has no
   dedicated split-button component; same reasoning as everywhere else in
   this file that composes existing atoms rather than waiting on a new
   lyra-ui primitive.

   Quick-reply mechanics: typing `/` (`QUICK_REPLY_TRIGGER_CHAR` —
   `/` rather than `#`, per explicit request: it's the near-universal
   chat-command convention, e.g. Slack/Discord/Front/Intercom/Zendesk,
   where `#` almost always means a hashtag/channel instead) followed by
   any run of word characters with the caret still immediately after them
   (`QUICK_REPLY_TRIGGER_PATTERN`, re-tested against the text up to
   the caret on every keystroke) opens the menu, filtered to items whose
   `id`/`title` contains what's typed so far; the (existing, previously
   unwired) "Quick replies" toolbar button opens the same menu at the
   current caret with no filter instead, for agents who'd rather browse
   than type a shortcut from memory. `quickReplyTriggerStart` records
   where the inserted/replaced range begins — either the `/`'s own
   position (typed trigger) or the bare caret (toolbar button, nothing to
   replace, pure insert). The menu itself owns no keyboard state (see
   `QuickReplyMenu`'s own doc comment) — arrow keys/Enter/Escape are all
   handled by this component's `onKeyDown` on the `Textarea` itself, so
   the textarea never loses focus/caret position while browsing. Selecting
   a plain item inserts `template` immediately; selecting a `rich` one
   swaps the same on-screen spot to `QuickReplyVariableForm` instead of
   closing, so the agent can fill in its field(s) — see
   `fillQuickReplyTemplate`'s own doc comment for the bracketed-preview-
   vs-final-insert distinction — before either inserting or cancelling
   back out (Cancel closes the whole picker rather than returning to the
   list, same "start over from `/`" flow either way).

   `onSend` hands the typed text up to `handleSendMessage` (the main
   component, where `interactions`/`setInteractions` actually live — this
   component has no access to that state itself) — that's what pushes the
   message into the active interaction's `liveMessages` and schedules the
   simulated customer reply. This component still owns nothing but the
   input's own text (and now the quick-reply picker's transient state);
   it doesn't know or care what happens to a message once sent. */
export function InteractionComposer({
  onSend,
  prefill,
  onPrefillConsumed,
  copilotSuggestions,
  copilotSuggestionLinks,
  copilotSuggestionReplacements,
  onCopilotSuggestionLink,
  onCopilotAsk,
  copilotOnly,
  onTakeover,
  takeoverLabel = "Takeover Chat",
  takeoverDisabled,
  takeoverDisabledReason,
  hideAiActions,
  onHideAiActionsChange,
  copilotDock,
  floatingMenus = false,
  replyBlockedReason,
}: {
  /** Set while the agent's own state blocks replying (presence): the chat
   *  input, Send and the quick-reply trigger stay visible but disabled, under
   *  an InlineNotification reading this. The transcript stays readable. */
  replyBlockedReason?: string;
  /** The quick-reply menu (and its variable form) float on the document's
   *  top layer, anchored above the composer, instead of in its flow: for a
   *  composer inside a size-limited surface (a header hover preview) that
   *  would clip it. The layer is tagged `data-floating-layer`. */
  floatingMenus?: boolean;
  /** Settings → AI display "In the Contact Details panel": the Ask Copilot
   *  part (chips, input, Takeover) renders as the panel's docked footer
   *  (portaled into `mount`) instead of here; this composer keeps only the
   *  chat input. `mount` is the page's stable Copilot host: while no slot
   *  holds it (the panel isn't showing its Overview) the Copilot part stays
   *  mounted, off screen. */
  copilotDock?: { mount: HTMLElement | null };
  /** Shows a "Hide AI Actions" switch at the right of the mode toggle row. */
  hideAiActions?: boolean;
  onHideAiActionsChange?: (hide: boolean) => void;
  takeoverLabel?: string;
  takeoverDisabled?: boolean;
  takeoverDisabledReason?: string;
  /** Show only the Ask Copilot input (no Chat with Customer toggle) — used while the agent is reviewing an AI-led chat. */
  copilotOnly?: boolean;
  /** With `copilotOnly`: shows a "Take over" button in place of the toggle. */
  onTakeover?: () => void;
  /** Suggestion chips shown under the "Ask Copilot" input; clicking one fills the question. */
  copilotSuggestions?: string[];
  /** label → link key for chips that open a side panel (after a brief spinner) instead of filling the input. */
  copilotSuggestionLinks?: Record<string, string>;
  /** A used link chip is swapped for this replacement (label → replacement label). */
  copilotSuggestionReplacements?: Record<string, string>;
  onCopilotSuggestionLink?: (link: string) => void;
  /** Fired whenever the agent asks Copilot something (submits a question, or uses a chip that runs a lookup) —
   *  the caller adds a matching interstitial row to the chat. */
  onCopilotAsk?: (text: string) => void;
  onSend: (text: string) => void;
  /** Populates the composer's own text WITHOUT sending it — per explicit
   *  request ("When one is clicked it should populate into the input but
   *  not send until the agent clicks send"), for Copilot's suggested-reply
   *  cards (currently only Marcus Webb's scripted scenario,
   *  `AgentWorkspace2WithDeskPage.tsx`). This component still owns its own
   *  `message` state (unchanged, uncontrolled) — `prefill` is a one-shot
   *  injection into that state via the `useEffect` below, not a switch to a
   *  fully controlled input: the agent can still freely edit/clear the
   *  populated text afterward like anything else they typed themselves.
   *  Left `undefined` by every OTHER caller (no behavior change for them). */
  prefill?: string;
  /** Fired the instant `prefill` is consumed (copied into `message`) — the
   *  caller's cue to reset its own `prefill` value back to `undefined`.
   *  Required so a SECOND, later `prefill` call can ever take effect at
   *  all: the effect below is keyed on `[prefill]`, so if the caller left
   *  its own prefill value sitting non-`undefined` after the first one
   *  landed, setting the exact same string again wouldn't change that
   *  dependency and the effect simply wouldn't refire. Resetting to
   *  `undefined` in between means every distinct suggestion the agent
   *  clicks — even if it happens to be identical text — reliably re-fires
   *  this effect. */
  onPrefillConsumed?: () => void;
}) {
  const [composerTabState, setComposerTab] = useState<"chat" | "copilot">("chat");
  const copilotDocked = !!copilotDock;
  const composerTab = copilotDocked ? "chat" : copilotOnly ? "copilot" : composerTabState;
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotLoading, setCopilotLoading] = useState<string | null>(null);
  // Switching modes puts the caret straight into that mode's input so the agent can just start typing
  // (skipped on first mount so the composer doesn't steal focus when it appears).
  const copilotPaneRef = useRef<HTMLDivElement>(null);
  // Focus only when the agent actually switches modes with the toggle: compare against the previous tab so mount
  // (and dev double-invoked effects) never steal focus.
  const prevComposerTab = useRef(composerTab);
  useEffect(() => {
    if (prevComposerTab.current === composerTab) return;
    prevComposerTab.current = composerTab;
    if (composerTab === "chat") {
      textareaRef.current?.focus();
    } else {
      copilotPaneRef.current?.querySelector<HTMLElement>("textarea, input")?.focus();
    }
  }, [composerTab]);
  const [copilotUsed, setCopilotUsed] = useState<string[]>([]);
  const activateCopilotSuggestion = (suggestion: string) => {
    const link = copilotSuggestionLinks?.[suggestion];
    if (!link) {
      setCopilotQuestion(suggestion);
      return;
    }
    if (copilotLoading) return;
    setCopilotLoading(suggestion);
    onCopilotAsk?.(suggestion);
    window.setTimeout(() => {
      setCopilotLoading(null);
      setCopilotUsed((prev) => [...prev, suggestion]);
      onCopilotSuggestionLink?.(link);
    }, 1400);
  };
  const [message, setMessage] = useState("");
  const canSend = message.trim().length > 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // See `prefill`'s own doc comment above for the full "why" — this just
  // performs the one-shot injection + focus, then immediately hands control
  // back to the caller to reset `prefill` to `undefined` again.
  useEffect(() => {
    if (prefill === undefined) return;
    setMessage(prefill);
    setComposerTab("chat");
    onPrefillConsumed?.();
    // The textarea's own auto-grow (further down this component, if any)
    // and caret placement both need the DOM to have actually committed
    // `message`'s new value first.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus();
      el?.setSelectionRange(prefill.length, prefill.length);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);
  // Per explicit request: tabbing out of the message textarea should land
  // on the Send button first — not the toolbar's Attach/Bold/Italic/etc.
  // icon buttons, which sit BEFORE Send in visual/DOM order (see the render
  // below) and so would otherwise be next in line for a plain, un-messed-
  // with browser Tab order. `handleComposerKeyDown` intercepts Tab on the
  // textarea itself and focuses this directly instead of letting the
  // browser's default order run.
  const sendButtonRef = useRef<HTMLButtonElement>(null);

  // ── Quick-reply picker state ──
  // `quickReplyTriggerStart` is the message-text index the eventually-
  // inserted text replaces through to the caret at insert time — either
  // where the typed trigger character itself sits (so "/time" gets
  // replaced outright),
  // or the bare caret position when opened via the toolbar button instead
  // (nothing typed to replace, a pure insert at that point). `null` means
  // closed. See this component's own doc comment above for the full flow.
  const [quickReplyTriggerStart, setQuickReplyTriggerStart] = useState<number | null>(null);
  const [quickReplyQuery, setQuickReplyQuery] = useState("");
  const [quickReplyActiveIndex, setQuickReplyActiveIndex] = useState(0);
  // Non-null while showing `QuickReplyVariableForm` for a `rich` item
  // instead of the plain matching list — same overlay slot, different
  // content (see the render below).
  const [quickReplyConfiguring, setQuickReplyConfiguring] = useState<QuickReplyItem | null>(null);
  const [quickReplyFieldValues, setQuickReplyFieldValues] = useState<Record<string, string | Date | undefined>>({});
  const quickReplyOpen = quickReplyTriggerStart !== null;
  const quickReplyContainerRef = useRef<HTMLDivElement>(null);

  const quickReplyMatches = useMemo(() => {
    const q = quickReplyQuery.trim().toLowerCase();
    if (!q) return QUICK_REPLIES;
    return QUICK_REPLIES.filter(
      (item) => item.id.toLowerCase().includes(q) || item.title.toLowerCase().includes(q)
    );
  }, [quickReplyQuery]);

  const closeQuickReplyMenu = () => {
    setQuickReplyTriggerStart(null);
    setQuickReplyQuery("");
    setQuickReplyActiveIndex(0);
    setQuickReplyConfiguring(null);
    setQuickReplyFieldValues({});
  };

  // Dismiss on outside click — this menu is a plain absolutely-positioned
  // overlay, not a `Popover` (see this component's own doc comment for
  // why: the `Textarea` itself must keep focus/caret while browsing, which
  // rules out a focus-trapping Radix popover). `mousedown` (not `click`)
  // so this fires before a menu-row's own `onClick` — the row's click
  // handler still runs normally afterward since it's inside
  // `quickReplyContainerRef` and skipped here.
  //
  // The `[data-radix-popper-content-wrapper]` check covers
  // `QuickReplyVariableForm`'s own `Select`/`DatePicker`/`TimePicker`
  // fields — Radix always portals THEIR dropdown/calendar content
  // straight to `document.body`, outside `quickReplyContainerRef`'s own
  // DOM subtree, no matter how deeply nested those fields are inside it.
  // Without this, picking e.g. a Business Days option registered as an
  // "outside" click and closed the whole rich form before the selection
  // even landed — confirmed live. Every Radix popper-positioned surface
  // (`Popover`/`Select`/`DropdownMenu`/etc., all built on
  // `@radix-ui/react-popper`) tags its own wrapper with this attribute,
  // so this isn't specific to any one field type.
  useEffect(() => {
    if (!quickReplyOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (quickReplyContainerRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-radix-popper-content-wrapper], [data-floating-layer]")) return;
      closeQuickReplyMenu();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [quickReplyOpen]);
  // `floatingMenus`: where the floating menu sits (above the composer, as
  // wide as it or wider, up to the viewport's top).
  const composerRootRef = useRef<HTMLDivElement>(null);
  const [floatingMenuBox, setFloatingMenuBox] = useState<React.CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!floatingMenus || !quickReplyOpen || !composerRootRef.current) {
      setFloatingMenuBox(null);
      return;
    }
    const rect = composerRootRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 440);
    setFloatingMenuBox({
      position: "fixed",
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      bottom: window.innerHeight - rect.top + 8,
      width,
      maxHeight: Math.max(160, rect.top - 16),
      overflowY: "auto",
      zIndex: 60,
    });
  }, [floatingMenus, quickReplyOpen]);
  const placeMenu = (menu: React.ReactElement) =>
    floatingMenus
      ? floatingMenuBox &&
        createPortal(
          <div data-floating-layer="" style={floatingMenuBox} className="rounded-lyra-lg shadow-lg">
            {menu}
          </div>,
          document.body,
        )
      : menu;

  // Replaces `[quickReplyTriggerStart, caret)` — the typed "/query" (or,
  // for the toolbar-button path, a zero-length range right at the caret)
  // — with `text`, then restores focus with the caret placed right after
  // the newly-inserted text. `requestAnimationFrame` — the caret can only
  // be repositioned after React actually commits the new `value` to the
  // DOM `<textarea>`, which hasn't happened yet inside this same handler.
  const insertQuickReplyText = (text: string) => {
    const el = textareaRef.current;
    const start = quickReplyTriggerStart ?? el?.selectionStart ?? message.length;
    const end = el?.selectionStart ?? message.length;
    const next = message.slice(0, start) + text + message.slice(end);
    setMessage(next);
    const caret = start + text.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const handleSelectQuickReply = (item: QuickReplyItem) => {
    if (item.rich) {
      setQuickReplyConfiguring(item);
      setQuickReplyFieldValues({});
      return;
    }
    insertQuickReplyText(item.template);
    closeQuickReplyMenu();
  };

  const handleInsertRichQuickReply = () => {
    if (!quickReplyConfiguring) return;
    insertQuickReplyText(fillQuickReplyTemplate(quickReplyConfiguring, quickReplyFieldValues, false));
    closeQuickReplyMenu();
  };

  const openQuickReplyMenuAtCaret = () => {
    const el = textareaRef.current;
    setQuickReplyTriggerStart(el?.selectionStart ?? message.length);
    setQuickReplyQuery("");
    setQuickReplyActiveIndex(0);
    el?.focus();
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    const caret = e.target.selectionStart ?? value.length;
    const match = QUICK_REPLY_TRIGGER_PATTERN.exec(value.slice(0, caret));
    if (match) {
      setQuickReplyTriggerStart(caret - match[0].length);
      setQuickReplyQuery(match[1]);
      setQuickReplyActiveIndex(0);
    } else if (quickReplyOpen && !quickReplyConfiguring) {
      // Only auto-closes the plain matching list on a non-matching edit —
      // once `quickReplyConfiguring` is set the agent's focus has moved
      // into the variable form's own fields, so further edits (there
      // shouldn't be any — the textarea isn't part of that flow anymore)
      // shouldn't tear down the form out from under them.
      closeQuickReplyMenu();
    }
  };

  // Arrow keys/Enter/Escape all handled here, not inside `QuickReplyMenu`
  // itself — see this component's own doc comment for why the textarea
  // must keep owning focus/caret the whole time the menu is open.
  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (quickReplyOpen && !quickReplyConfiguring) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setQuickReplyActiveIndex((i) => Math.min(i + 1, Math.max(quickReplyMatches.length - 1, 0)));
          break;
        case "ArrowUp":
          e.preventDefault();
          setQuickReplyActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          if (quickReplyMatches[quickReplyActiveIndex]) {
            e.preventDefault();
            handleSelectQuickReply(quickReplyMatches[quickReplyActiveIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closeQuickReplyMenu();
          break;
      }
      return;
    }
    // Per explicit request — ordinary typing (the quick-reply picker isn't
    // up): plain Enter sends the message, same as most chat composers
    // (Slack/Intercom/etc.); Shift+Enter still inserts a real newline,
    // since the textarea is multi-line (`rows={3}`) and losing that would
    // make a multi-paragraph reply impossible to type. `handleSend` itself
    // already no-ops on an empty/whitespace-only message (`canSend`), so
    // this is safe to fire unconditionally on a bare Enter.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Same request, other half: Tab out of the textarea goes straight to
    // Send, not into the Attach/Bold/Italic/Emoji/Quick replies/Templates
    // toolbar row that sits before it in DOM order (see the render below) —
    // those would otherwise be next in a plain, un-intercepted Tab order.
    // Shift+Tab (backing OUT of the textarea) is left alone, same reasoning
    // `Enter` above leaves Shift+Enter alone.
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      sendButtonRef.current?.focus();
    }
  };

  const handleSend = () => {
    if (!canSend || replyBlockedReason) return;
    onSend(message);
    setMessage("");
  };

  const submitCopilot = (text: string) => {
    const q = (text ?? copilotQuestion).trim();
    if (q) onCopilotAsk?.(q);
    setCopilotQuestion("");
  };
  // A used link chip is swapped for its replacement, if any.
  const activeCopilotSuggestions = (copilotSuggestions ?? [])
    .map((sg) => (copilotUsed.includes(sg) ? copilotSuggestionReplacements?.[sg] : sg))
    .filter((sg): sg is string => !!sg && !copilotUsed.includes(sg));
  const takeover =
    copilotOnly && onTakeover
      ? { label: takeoverLabel, onClick: onTakeover, disabled: takeoverDisabled, disabledReason: takeoverDisabledReason }
      : undefined;
  const copilotComposer = (placement: "inline" | "panel") => (
    <CopilotComposer
      placement={placement}
      value={copilotQuestion}
      onChange={setCopilotQuestion}
      onSubmit={submitCopilot}
      suggestions={activeCopilotSuggestions}
      onActivateSuggestion={activateCopilotSuggestion}
      takeover={takeover}
      focusable={placement === "panel" || composerTab === "copilot"}
      paneRef={placement === "inline" ? copilotPaneRef : undefined}
      className={
        placement === "inline"
          ? `col-start-1 row-start-1 ${composerTab === "copilot" ? "animate-in fade-in-0 duration-200" : "invisible pointer-events-none"}`
          : undefined
      }
      aria-hidden={placement === "inline" ? composerTab !== "copilot" : undefined}
    />
  );

  // Docked (AI in the Contact Details panel): the same composer, portaled
  // into the panel's footer.
  const dockedCopilot = copilotDock?.mount
    ? createPortal(
        copilotComposer("panel"),
        copilotDock.mount,
      )
    : null;
  // The docked part keeps one place in the tree (first), whether or not the
  // inline chat renders, so a layout switch never remounts it.
  return (
    <>
    {dockedCopilot}
    {/* Copilot-only and docked: nothing stays inline. */}
    {!(copilotDocked && copilotOnly) && (
    <div ref={composerRootRef} className="relative shrink-0 bg-lyra-bg-surface-base px-6 py-4">
      <ComposerFade />
      {/* `max-w-[768px]` — kept in sync with the message-column wrapper's
          own matching width above (originally narrowed together from
          1200px to 1024px; later narrowed again, together with that
          wrapper and `VoiceCallControls`' own floating card in
          agent-next-gen-voice-call-controls.tsx, from 1024px to 768px per
          explicit request), so the composer stays the same width as the
          transcript content sitting above it. */}
      <div className="w-full max-w-[768px] mx-auto">
        {quickReplyOpen && (
          // Normal flow, NOT `absolute` — this used to float over the
          // transcript above (a sibling `flex-1 overflow-y-auto` box, not
          // a descendant this composer can resize directly), which
          // visually buried the last few messages behind an opaque panel
          // the agent couldn't scroll past. Sitting in-flow instead grows
          // this composer's own (`shrink-0`) height, which — same flexbox
          // math that already keeps the composer pinned to the bottom at
          // its natural size — shrinks the transcript's available height
          // to make room rather than covering any of it, so its own
          // scrolling keeps working exactly as before, just over a
          // shorter viewport while this is open.
          placeMenu(<div ref={quickReplyContainerRef} className={floatingMenus ? undefined : "mb-2"}>
            {quickReplyConfiguring ? (
              <QuickReplyVariableForm
                title={quickReplyConfiguring.title}
                hashtagId={quickReplyConfiguring.id}
                triggerChar={QUICK_REPLY_TRIGGER_CHAR}
                fields={quickReplyConfiguring.fields ?? []}
                values={quickReplyFieldValues}
                onValueChange={(key, value) => setQuickReplyFieldValues((prev) => ({ ...prev, [key]: value }))}
                preview={fillQuickReplyTemplate(quickReplyConfiguring, quickReplyFieldValues, true)}
                onCancel={closeQuickReplyMenu}
                onClose={closeQuickReplyMenu}
                onInsert={handleInsertRichQuickReply}
              />
            ) : (
              <QuickReplyMenu
                query={quickReplyQuery}
                triggerChar={QUICK_REPLY_TRIGGER_CHAR}
                items={quickReplyMatches.map((item): QuickReplyMenuItem => ({
                  id: item.id,
                  title: item.title,
                  preview: item.template,
                  rich: item.rich,
                }))}
                activeIndex={quickReplyActiveIndex}
                onHoverItem={setQuickReplyActiveIndex}
                onSelect={(menuItem) => {
                  const item = QUICK_REPLIES.find((r) => r.id === menuItem.id);
                  if (item) handleSelectQuickReply(item);
                }}
                onClose={closeQuickReplyMenu}
              />
            )}
          </div>)
        )}
        {/* "Chat with Customer" / "Ask Copilot" tabs: the chat input stays mounted (just hidden) while Copilot is showing so a draft is kept. */}
        {/* Docked Copilot: no mode toggle here, the chat input stands alone. */}
        {copilotDocked ? null : copilotOnly ? (
          // Copilot-only (agent reviewing an AI-led chat): no mode toggle, just the switch at the right.
          onHideAiActionsChange && (
            <div className="mb-3 flex justify-end">
              <Switch size="sm" label="Hide AI Actions" checked={!!hideAiActions} onCheckedChange={onHideAiActionsChange} />
            </div>
          )
        ) : (
        <div className="mb-3 flex items-center justify-between gap-3">
        <ToggleGroup
          ariaLabel="Composer mode"
          allowDeselect={false}
          items={[
            { value: "chat", label: "Chat with Customer" },
            { value: "copilot", label: "Ask Copilot" },
          ]}
          value={composerTab}
          onValueChange={(next: string) => {
            // Always exactly one mode active: ignore the empty value a re-click may emit.
            if (next === "chat" || next === "copilot") setComposerTab(next);
          }}
        />
        {onHideAiActionsChange && (
          <Switch
            size="sm"
            label="Hide AI Actions"
            checked={!!hideAiActions}
            onCheckedChange={onHideAiActionsChange}
          />
        )}
        </div>
        )}
        {/* Both panes share one grid cell so the area keeps the taller (chat) height on either tab.
            `minmax(0,1fr)`: the cell is the column's width, never a pane's min-content. */}
        <div className="grid grid-cols-[minmax(0,1fr)]">
        {!copilotDocked && copilotComposer("inline")}
        <div className={`col-start-1 row-start-1 ${composerTab === "chat" ? "" : "invisible pointer-events-none"}`} aria-hidden={composerTab !== "chat"}>
        {replyBlockedReason && (
          <InlineNotification variant="warning" className="mb-2" data-slot="reply-blocked">
            {replyBlockedReason}
          </InlineNotification>
        )}
        <Textarea
          ref={textareaRef}
          placeholder="Type a message... or / for quick replies"
          rows={3}
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleComposerKeyDown}
          disabled={!!replyBlockedReason}
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <ActionIconButton size="sm" title="Attach file">
              <Paperclip className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Bold">
              <Bold className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Italic">
              <Italic className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Emoji">
              <Smile className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Quick replies" onClick={openQuickReplyMenuAtCaret} disabled={!!replyBlockedReason}>
              <Zap className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Templates">
              <FileText className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
          </div>
          <div className="inline-flex items-center">
            <Button
              ref={sendButtonRef}
              variant="default"
              size="lg"
              className="gap-1.5 rounded-r-none"
              disabled={!canSend || !!replyBlockedReason}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" strokeWidth={1.5} />
              Send
            </Button>
            <Button
              variant="default"
              size="icon-lg"
              className="rounded-l-none border-l border-white/25"
              disabled={!canSend || !!replyBlockedReason}
              title="More send options"
            >
              <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
        </div>
        </div>
      </div>
    </div>
    )}
    </>
  );
}
