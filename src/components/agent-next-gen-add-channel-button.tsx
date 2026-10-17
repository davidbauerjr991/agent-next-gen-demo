// AddChannelAdHocButton — 2.0's record header "+" Add Channel trigger (see
// AgentNextGenPage.tsx's own `showAddChannelActions` render call site).
//
// Restored per explicit follow-up request after being deleted during the
// Premium/Advanced "Phase D" simplification (which swapped THEIR "+" trigger
// over to lyra-ui's own stock `AddChannelButton`/`getHeaderAction` picker —
// see BEHAVIOR.md §23). That swap doesn't work for 2.0: `getHeaderAction`
// looks up the interaction's own id in `outboundConfig.groups` (the real
// customer/agent directory) to build its button, and returns `null` — no
// button at all — for any id that isn't a real, known contact (see
// `handleRedial`'s own doc comment for a fully-worked example of this exact
// bug). Since 2.0 has "no real customer database" by design (every
// interaction is 1:1, frequently a raw quick-dialed number or other ad-hoc
// contact with no backing directory record), that lookup fails often enough
// that the standard picker silently disappears for exactly the customers who
// need it most. This ad-hoc-only popup sidesteps the directory lookup
// entirely — it never calls `getHeaderAction`/`useAddChannelButton` at all,
// so it always renders and always works, regardless of whether the active
// interaction has a real contact record behind it.
//
// Deliberately a plain presentational component, not wired to the page's own
// `interactions` state directly — `onLaunch` hands the typed query and
// detected channel back to whichever page rendered this, so that page can
// add the new Thread onto ITS OWN currently active interaction using its own
// `setInteractions`/`clockTick`/`generateContactId` (see
// AgentNextGenPage.tsx's own `handleAddAdHocChannel`). Shared here (not
// hand-duplicated per page) since none of that page-specific wiring lives
// inside this component at all — only the popover's own open/typed-value UI
// state does.
import * as React from "react";
import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Button,
  Input,
  Popover,
  PanelHeader,
  RadioButtonGroup,
  Select,
  looksLikeEmail,
  looksLikePhoneNumber,
  type ChannelType,
} from "@nicecxone/lyra-ui";
import { useChannelDisabledReasons } from "@/contact-handling/presence-gates";

export interface AddChannelAdHocButtonProps {
  /** Fires once the agent finishes the popup's flow — `query` is the
   *  trimmed, exact text they typed (possibly edited on step 2, see
   *  below); `channel` is `"email"` for anything email-shaped (fires
   *  immediately on "Continue with '{query}'", no further step, per the
   *  `skillId` guard below). For phone-shaped input, "Continue with
   *  '{query}'" no longer fires this directly — it instead advances to a
   *  second step showing the same phone `Input` (still editable) plus a
   *  "Select Channel" `RadioButtonGroup` (SMS vs Voice, mirroring
   *  `create-new.tsx`'s own New Outbound detail screen) and a "Start
   *  Interaction" button, per explicit request ("when a channel is added
   *  that is a phone number and Continue... is selected, display radio
   *  buttons for sms or voice... so the agent can choose what type of
   *  interaction to open", further followed up with "the updated add
   *  channel should display the phone input as well as the select channel
   *  radios (so the agent can change the phone if they want) then add the
   *  start interaction button"). Only fires once the agent picks a channel
   *  and presses "Start Interaction". `skillId` is `skillOptions`'s own
   *  value — per explicit follow-up request ("make sure to include a
   *  skill when adding a new channel to non-connected customers"), this
   *  ad-hoc flow now always resolves one before launching, same as the
   *  known-contact `AddChannelButton` flow's own "Outbound Skill" field,
   *  just defaulted to the FIRST option (see `skillId`'s own state
   *  initializer below) so picking one is never a required extra step
   *  unless the agent wants to change it. The popover closes and its
   *  field/step resets immediately after this fires — callers don't need
   *  to do either themselves. */
  onLaunch: (query: string, channel: ChannelType, skillId: string) => void;
  /** Options for this popup's own "Outbound Skill" dropdown — same
   *  `{value, label}` shape (and, for any caller that also renders the
   *  known-contact `AddChannelButton` flow, the literal same list)
   *  `CreateNewOutboundConfig.skillOptions` already uses, reused here (not
   *  redefined) so both add-channel flows offer the exact same skill
   *  vocabulary. An empty array is a valid (if degenerate) input — same
   *  "nothing to default to, so the button stays disabled" fallback
   *  `create-new.tsx`'s own `detailSkill` initializer documents for the
   *  identical edge case. */
  skillOptions: { value: string; label: string }[];
  /** Optional trigger sizing override — the trigger is a plain `Button
   *  variant="default" size="icon-md"`, so its resting color/shape is
   *  already the correct solid-primary blue with `rounded-lyra-sm` corners
   *  with no override needed; this only exists for a caller that needs a
   *  different SIZE (e.g. a narrower/wider header). */
  className?: string;
  /** Channels this card can't start now, with the reason (e.g. Voice while
   *  the customer is on a call, k8 6); merged over the presence reasons. */
  channelDisabledReasons?: Partial<Record<ChannelType, string>>;
}

/** Blue "+" trigger + small "Add Channel" popover: a bare "Enter Email Or
 *  Phone Number" field, an "Outbound Skill" dropdown (see `skillId`'s own
 *  comment below), and — once the typed value looks like a real email or
 *  phone number — a "Continue with '{value}'" button that fires `onLaunch`
 *  immediately, with no further detail screen for email (per explicit
 *  request — this always launches right away, same immediacy as
 *  `CreateNewOutboundContact.quickLaunch`'s own skip-the-detail-screen
 *  behavior elsewhere in this app; phone-shaped input still advances to its
 *  own second step, see `onLaunch`'s own doc comment). */
function AddChannelAdHocButton({ onLaunch, skillOptions, className, channelDisabledReasons }: AddChannelAdHocButtonProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  // Second-step state, phone-shaped input only — see `onLaunch`'s own doc
  // comment above for why this step exists. `phoneChannel` starts empty
  // (no default selection) so the confirm button stays disabled until the
  // agent actually makes a choice, same "no silent default" reasoning as
  // every other required Select/RadioButtonGroup in this app.
  const [choosingPhoneChannel, setChoosingPhoneChannel] = useState(false);
  const [phoneChannel, setPhoneChannel] = useState<"sms" | "voice" | "">("");
  // Defaults to the FIRST skill in `skillOptions`, not `""` — same "agent
  // can launch immediately without having to choose" reasoning
  // `create-new.tsx`'s own `detailSkill` initializer documents for the
  // known-contact flow's identical field, reused here per explicit request
  // ("make sure to include a skill when adding a new channel to
  // non-connected customers"). Still falls back to `""` for the true edge
  // case of an empty list — both launch buttons below stay disabled via
  // their own `!skillId` check in that case, same as `create-new.tsx`.
  const [skillId, setSkillId] = useState(skillOptions[0]?.value ?? "");
  const disabledReasons = { ...channelDisabledReasons, ...useChannelDisabledReasons() };
  // A choice that became disabled (the agent went Unavailable on step 2) can't launch.
  const phoneChannelBlocked = !!phoneChannel && !!disabledReasons?.[phoneChannel];

  const trimmed = value.trim();
  const isEmail = looksLikeEmail(trimmed);
  const isPhone = !isEmail && looksLikePhoneNumber(trimmed);
  const canContinue = isEmail || isPhone;

  const closeAndReset = () => {
    setOpen(false);
    setValue("");
    setChoosingPhoneChannel(false);
    setPhoneChannel("");
    // Back to the first skill, not `""` — same reasoning as this state's
    // own initializer above.
    setSkillId(skillOptions[0]?.value ?? "");
  };

  const handleContinue = () => {
    // Step 2 (phone only): confirm the SMS/Voice choice and launch.
    if (choosingPhoneChannel) {
      if (!phoneChannel || !skillId || phoneChannelBlocked) return;
      onLaunch(trimmed, phoneChannel, skillId);
      closeAndReset();
      return;
    }
    if (!canContinue || !skillId) return;
    // Phone-shaped input doesn't launch yet — it advances to the
    // SMS/Voice step instead (see `onLaunch`'s own doc comment).
    if (isPhone) {
      setChoosingPhoneChannel(true);
      return;
    }
    onLaunch(trimmed, "email", skillId);
    closeAndReset();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : closeAndReset())}
      placement="bottom"
      align="start"
      // Per explicit follow-up request ("the padding on the popover is not
      // correct"): was `w-80` (320px) — `Popover`'s own body wrapper already
      // applies its standard 20px (`px-5`) inset by default (`bodyPadding`,
      // popover.tsx — this component never opts out of it), so the visible
      // "no padding" symptom wasn't a missing-inset bug, it was the fixed
      // "name@example.com or (555) 555-5555" placeholder simply not fitting
      // that 280px-of-actual-room content box, clipping right against the
      // input's own edge. `w-96` (384px) gives real typed input (a genuine
      // email address can run long) enough room without crowding the
      // container's own 20px right inset the way the narrower box did.
      className="w-96"
      onCloseAutoFocus={(e: Event) => e.preventDefault()}
      header={<PanelHeader title="Add Channel" bordered={false} className="px-5 pb-0" onClose={closeAndReset} />}
      // Per explicit follow-up request ("the padding-bottom is not
      // correct"): the "Continue with" button used to live inside `content`
      // itself, sharing that div's own `pb-2` — exactly the hand-rolled-
      // footer-inside-content anti-pattern CLAUDE.md's rule #28 already
      // calls out for this same "Popover with header + content + a trailing
      // action row" shape (`TranscriptSessionSeparator`'s "Close Contact?"
      // confirm view made, and fixed, the identical mistake). Moved into
      // Popover's own real `footer` slot instead, with the same `px-5 pb-4
      // pt-1` every other footer in this app already uses (see that
      // component's own Close/Cancel and Approve & Save rows,
      // agent-next-gen-transcript.tsx) — `content` now ends cleanly with
      // its own `pb-2` whether or not the footer is showing, instead of the
      // button's presence changing how much bottom padding the WHOLE body
      // effectively had.
      footer={
        // Per further explicit follow-up request ("the updated add channel
        // should display the phone input as well as the select channel
        // radios (so the agent can change the phone if they want) then add
        // the start interaction button"): step 2's footer button now reads
        // "Start Interaction" (the actual launch action, not just an
        // intermediate "Continue") and stays disabled until BOTH the phone
        // field still holds a valid phone-shaped value (`canContinue` —
        // the agent can edit it in place on this step, see `content`
        // below, and an edit that breaks the phone shape should block
        // launch same as an empty field would), a channel is picked
        // (`phoneChannel`), AND a skill is resolved (`skillId` — see that
        // state's own doc comment; only ever unmet for the empty-
        // `skillOptions` edge case, since it otherwise defaults to the
        // first option).
        choosingPhoneChannel ? (
          <div className="px-5 pb-4 pt-1">
            <Button variant="outline" size="lg" wrap className="w-full" disabled={!canContinue || !phoneChannel || !skillId || phoneChannelBlocked} onClick={handleContinue}>
              Start Interaction
            </Button>
          </div>
        ) : canContinue ? (
          <div className="px-5 pb-4 pt-1">
            <Button variant="outline" size="lg" wrap className="w-full" disabled={!skillId} onClick={handleContinue}>
              Continue with &quot;{trimmed}&quot;
            </Button>
          </div>
        ) : undefined
      }
      content={
        choosingPhoneChannel ? (
          // Per explicit follow-up request ("when a channel is added that
          // is a phone number and Continue... is selected, display radio
          // buttons for sms or voice (like you do with new outbound)"),
          // and the further follow-up above (phone field stays visible +
          // editable on this step too, not just the radios): the phone
          // `Input` from step 1 carries over onto this step unchanged
          // (same `value`/`onChange`, still typeable) directly above the
          // `RadioButtonGroup` — reuses the exact `RadioButtonGroup`
          // component (and "Select Channel" label) `create-new.tsx`'s own
          // New Outbound detail screen already uses for its own channel
          // picker (radio-button-group.tsx), instead of a locally
          // hand-rolled pair of buttons — same "extend/reuse the design
          // system" reasoning as every other shared-primitive call in this
          // file.
          <div className="flex flex-col gap-3 pt-1 pb-2">
            <Input
              label="Enter Email Or Phone Number"
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
              placeholder="Email or phone number"
            />
            <RadioButtonGroup
              label="Select Channel"
              // Presence: Voice stays listed, disabled with its reason.
              options={[
                { value: "sms", label: "SMS", disabled: !!disabledReasons?.sms, disabledReason: disabledReasons?.sms },
                { value: "voice", label: "Voice", disabled: !!disabledReasons?.voice, disabledReason: disabledReasons?.voice },
              ]}
              value={phoneChannel}
              onValueChange={(v) => setPhoneChannel(v as "sms" | "voice")}
            />
            {/* Same "Outbound Skill" field (label/placeholder/shape)
                `create-new.tsx`'s own known-contact detail screen uses —
                see `skillId`'s own doc comment above for why this ad-hoc
                flow now always resolves one too. */}
            <Select
              label="Outbound Skill"
              placeholder="Select Outbound Skill"
              value={skillId || undefined}
              onValueChange={setSkillId}
              options={skillOptions}
            />
          </div>
        ) : (
          // Per explicit follow-up request ("update the padding below the
          // enter email or phone input to match the padding-left and
          // right"): bottom padding is now `pb-5` (20px) — matching the
          // `px-5` (20px) horizontal inset `Popover`'s own body wrapper
          // applies (popover.tsx's `bodyPadding`) — instead of the smaller
          // `pb-2` (8px) it had before, which read as a missing/uneven inset
          // once the "Continue with" button (which used to visually fill
          // that gap) moved into the real `footer` slot below `content`.
          // Only applies when there's no footer to follow — `canContinue`
          // true still uses the tighter `pb-2` spacer, since the footer's
          // own `pt-1` picks up right after it and supplies the real bottom
          // edge (`px-5 pb-4 pt-1`) itself; adding both would double up.
          <div className={`flex flex-col gap-3 pt-1 ${canContinue ? "pb-2" : "pb-5"}`}>
            <Input
              label="Enter Email Or Phone Number"
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
              // Shortened from the full "name@example.com or (555) 555-5555"
              // — even at the new `w-96` width, that longer string left
              // almost no visible margin before the input's own right edge.
              placeholder="Email or phone number"
              autoFocus
            />
            {/* Email-shaped input launches straight from this step (no
                second step the way phone-shaped input gets, see `onLaunch`'s
                own doc comment) — so this is the only place its own
                "Outbound Skill" field can live. Phone-shaped input gets the
                identical field one step later instead (`choosingPhoneChannel`
                branch above), not duplicated here too. */}
            {isEmail && (
              <Select
                label="Outbound Skill"
                placeholder="Select Outbound Skill"
                value={skillId || undefined}
                onValueChange={setSkillId}
                options={skillOptions}
              />
            )}
          </div>
        )
      }
    >
      {/* Per explicit follow-up request ("the plus button is displaying a
          black plus"): was `ActionIconButton` (hardcoded `variant="icon"`
          internally, actions.tsx) with a `className` override trying to
          force its baked-in `text-lyra-fg-action` to `text-lyra-fg-on-
          primary` — `cn()`'s `tailwind-merge` doesn't recognize those two
          custom-token classes as the same conflicting utility, so the
          override never reliably won and the icon rendered in `icon`
          variant's own default action-gray/black, not the intended white.
          A plain `Button variant="default"` already IS the correct solid-
          primary/white-text combo `buttonVariants` bakes in (button.tsx) —
          no color override needed at all, and `size="icon-md"` keeps this
          the same 32px `ActionIconButton size="sm"` used to render (see
          `ACTION_ICON_BUTTON_SIZE_MAP`, actions.tsx). `Button` itself
          auto-wraps any icon-sized variant with `title` set in a Tooltip +
          `aria-label` (its own `isIconVariant && title` branch), so no
          separate `aria-label` prop is needed here either. */}
      <Button
        variant="default"
        size="icon-md"
        title="Add Channel"
        className={className}
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      </Button>
    </Popover>
  );
}

export { AddChannelAdHocButton };
