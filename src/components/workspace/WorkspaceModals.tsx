import { AgentLegDisconnectedToast, AgentWelcomeMessage, Button, Modal, Toast, ToastContainer } from "@nicecxone/lyra-ui";
import { ConfirmCloseDialog } from "@/contact-handling";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { IfCapable } from "@/provider-context";
import { useSettings } from "@/settings";
import { AssignmentToastStack } from "./AssignmentToastStack";
import { CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_LAST_NAME } from "@/components/agent-next-gen-shared-utils";
import { VideoCallWindow } from "@/components/agent-next-gen-video-window";
import { WELCOME_MODAL_LAST_LOGIN } from "@/components/agent-next-gen-interaction-dashboard";

/** The page's overlays (P-EXTRACT C8, from the page): the dismiss confirm,
 *  the welcome modal, the floating video window and the toasts. */
export function WorkspaceModals() {
  const {
    activeChannelType, activeInteraction, agentLegDisconnectedToastOpen, appDisplayName, dismissAllToasts, liveVoiceCallInteraction,
    dismissToast, handleConnectAgentLeg, handleGoAvailable, handleStartUnavailable, logoSrc, pendingClose,
    setAgentLegDisconnectedToastOpen, setPendingClose, setShowWelcomeModal, setVoiceVideoFullScreen,
    setVoiceVideoWindowOpen, showWelcomeModal, toasts, voiceVideoFullScreen, voiceVideoWindowOpen,
  } = useWorkspace();
  const [{ toasts: toastSettings }] = useSettings("notifications");
  return (
    <>
      <ConfirmCloseDialog
        open={!!pendingClose}
        onConfirm={() => {
          const dismiss = pendingClose;
          setPendingClose(null);
          dismiss?.();
        }}
        onCancel={() => setPendingClose(null)}
      />
      {/* ── Welcome modal — shown once on page load. Uses the real lyra-ui
          `Modal` component (variant="light": frosted blur backdrop,
          portal-rendered via Radix Dialog, focus-trapped) rather than a
          hand-rolled backdrop div, so it actually dims/blurs the dashboard
          behind it like a real overlay instead of just painting over it.
          Not dismissible via backdrop click or Escape — only the two
          buttons close it. Previously composed by hand as `Overlay` +
          `AgentWelcomeMessage` (which itself rendered its own
          `Container variant="modal"` shell) — `Modal` now owns that
          Radix Dialog wiring directly, so `AgentWelcomeMessage` is passed
          `bare` to skip its own card chrome and avoid nesting two.

          `Modal`'s "light" variant is a fixed `bg-white/70` by design (see
          Overlay.stories.tsx — "light" vs. "dark" are two deliberately
          static, theme-independent overlay looks, not meant to react to
          dark mode). This page's backdrop needs to actually match the
          current theme, so we override just the background color via
          `overlayClassName` (twMerge drops the variant's `bg-white/70` for
          this `bg-[color-mix(...)]`, keeping `backdrop-blur-sm`). We use
          color-mix() instead of a plain `bg-lyra-bg-surface-shell/70`
          opacity modifier because Tailwind can't generate opacity-modified
          utilities for our `var(--lyra-color-*)` tokens (same root cause as
          the Tag border-color bug — see lyra-ui's PROJECT_SUMMARY.md).

          The card itself is still the shared `AgentWelcomeMessage` lyra-ui
          component (icon/title/lastLogin block + info-box slot + Separator +
          two-button footer) — `ariaTitle` gives screen readers the real
          dialog name since that title now renders inside `AgentWelcomeMessage`
          itself rather than through `Modal`'s own `headerTitle`. ── */}
      <Modal
        variant="light"
        overlayClassName="bg-[color-mix(in_srgb,var(--lyra-color-bg-surface-shell)_75%,transparent)]"
        open={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        closeOnBackdropClick={false}
        ariaTitle={`Good morning, ${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`}
      >
        {/* Info-box `children` (skills/teammates summary) hidden for
            now — per explicit request. `AgentWelcomeMessage` only renders
            that slot (and the Separator above the footer that goes with
            it) when `children` is actually passed, so simply omitting it
            here removes the box cleanly rather than rendering it empty.
            The numbers it used to show (`AGENT_SKILLS_COUNT`/
            `TEAMMATES_ONLINE_COUNT`/`TEAMMATES_AVAILABLE_COUNT`) are still
            defined/unused above — left in place to restore this easily
            later. */}
        <AgentWelcomeMessage
          bare
          icon={<img src={logoSrc} alt={appDisplayName} title={appDisplayName} className="h-8 w-8 shrink-0 object-contain" />}
          title={`Good morning, ${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`}
          lastLogin={WELCOME_MODAL_LAST_LOGIN}
          onPrimaryClick={handleGoAvailable}
          // Uses AgentWelcomeMessage's own default "Start Unavailable" label
          // (no secondaryLabel override — see CLAUDE.md's lyra-ui rules).
          // Per explicit follow-up request, reverted from a prior app-only
          // "Start Offline" override back to this default. Still calls
          // handleStartUnavailable, which sets the agent's real AgentStatus
          // to "unavailable" — lyra-ui's AgentStatus type has no distinct
          // "offline" value (dropped "offline" a while back, see
          // handleStartUnavailable's own doc comment above).
          onSecondaryClick={handleStartUnavailable}
        />
      </Modal>

      {/* Fired by `fireDismissToast` (`handleDismissInteraction`/
          `handleDismissChannel`), `fireAgentLegStatusToast`
          (`AgentProfile`'s own `onAgentLegStatusChange`), and
          `handleInteractionStatusChange` (any status pill/Outcome
          Resolution change) — kept at the very end of this tree, a sibling
          of everything else, same as `Modal` above, so it's always mounted
          regardless of which desk tab/panel is currently active.

          Wrapping `<div>` takes over the `fixed bottom-4 right-4`
          positioning `ToastContainer` normally owns itself (overridden
          below via its own `className` — `cn`'s `tailwind-merge` cleanly
          drops the conflicting defaults rather than fighting them) so the
          "Dismiss All" chip can sit as a normal flex sibling ABOVE the
          toast stack, per explicit request, rather than needing a second,
          separately-measured `fixed` element trying to track the first
          toast's ever-changing position by hand. */}
      {/* `z-[9999]` — same top-most tier `AppHeader`'s own menus reserve
          (see the floated-panel `zIndex: 40` cap's own doc comment a few
          hundred lines up) — was `z-50`, which sat comfortably above a
          normal docked/full-screen `CustomerInformationSidePanel` (`z-[5]`/
          `z-[9]`) but still lost to it visually once confirmed live (a
          save-confirmation toast peeking out from BEHIND the panel's own
          edit-mode content, not floating above it) — per explicit request,
          a toast should never be hidden behind ANY panel, so this jumps
          straight to the same reserved top tier menus use rather than
          guessing at some smaller number still under whatever the panel's
          own effective stacking context turns out to be. */}
      {/* Floating video window — see AgentNextGenPage.tsx's identical
          render site for the full positioning/z-index rationale, including
          why this is anchored via `left`/`top` (not `right`/`bottom` —
          that anchoring made the corner-resize handle visually grow the
          window LEFT/UP instead of right/down, a confirmed live bug) and
          why it's hidden while `voiceVideoFullScreen`. */}
      {voiceVideoWindowOpen && !voiceVideoFullScreen && activeInteraction && activeChannelType === "voice" && (
        <div
          className="fixed z-40"
          style={{ left: "calc(100vw - 324px)", top: "calc(100vh - 496px)" }}
        >
          <VideoCallWindow
            customerName={activeInteraction.customerName}
            onClose={() => setVoiceVideoWindowOpen(false)}
            onFullScreen={() => setVoiceVideoFullScreen(true)}
          />
        </div>
      )}
      <div
        // Bottom: above the voice bar while a call is live (P-HOME-1); top: under the app header.
        className={`fixed end-4 z-[9999] flex flex-col items-end gap-2 ${
          toastSettings.position === "topEnd" ? "top-16" : liveVoiceCallInteraction ? "bottom-28" : "bottom-4"
        }`}
      >
        {/* Only once there's more than one toast actually stacked up —
            with just one (or zero) on screen, its own "×" is already the
            one-click way to clear it; this chip only earns its place once
            dismissing them one at a time would actually be tedious. */}
        {/* Counts the dedicated agent-leg toast (below) alongside the plain
            `toasts` list — it's not part of that array (see
            `agentLegDisconnectedToastOpen`'s own doc comment above), but it
            still visually stacks with everything else here, so the chip's
            "is it worth a one-click clear-everything" threshold needs to
            count it too. */}
        {toasts.length + (agentLegDisconnectedToastOpen ? 1 : 0) > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              dismissAllToasts();
              // Not phased through `forceClosed`/a delayed removal the way
              // `dismissAllToasts` staggers the plain `toasts` list's own
              // exit animation — same accepted "immediate, unanimated
              // close" this toast's own "Connect" button already does (see
              // `handleConnectAgentLeg`), just triggered from "Dismiss All"
              // instead.
              setAgentLegDisconnectedToastOpen(false);
            }}
            className="rounded-full bg-lyra-bg-surface-overlay shadow-lg"
          >
            Dismiss All
          </Button>
        )}
        <ToastContainer className="static bottom-auto right-auto z-auto">
          {/* P-HOME-1: events on other assignments, newest on top. */}
          <AssignmentToastStack />
          {toasts.map((t) => (
            <Toast
              key={t.id}
              variant={t.variant}
              title={t.title}
              duration={t.duration}
              // Set by `dismissAllToasts` (toast.tsx) on every toast at
              // once, so clicking "Dismiss All" plays every toast's own
              // exit animation simultaneously instead of them vanishing
              // instantly — see `Toast`'s own `forceClosed` doc comment.
              forceClosed={t.closing}
              onDismiss={() => dismissToast(t.id)}
            >
              {t.message}
            </Toast>
          ))}
          {/* Dedicated "Agent Leg Disconnected" toast (lyra-ui) — see
              `agentLegDisconnectedToastOpen`'s own doc comment above for why
              this lives outside the plain `toasts` list. Only mounted while
              actually open, same "presence controls mounting" idiom the
              `.map()` above already uses per-item. */}
          <IfCapable when={(c) => c.interaction.agentLeg}>
            {agentLegDisconnectedToastOpen && (
              <AgentLegDisconnectedToast
                onConnect={handleConnectAgentLeg}
                onDismiss={() => setAgentLegDisconnectedToastOpen(false)}
              />
            )}
          </IfCapable>
        </ToastContainer>
      </div>
    </>
  );
}
