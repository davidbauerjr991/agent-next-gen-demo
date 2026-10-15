// Settings page (P-SETTINGS). Every control reads and writes the settings
// store through hooks and applies immediately; there's no save button.
// Settings with no target in the workspace yet stay toggleable (they count
// toward the preset) and carry a tag saying which step brings them.
import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  ActionIconButton,
  Badge,
  Button,
  Checkbox,
  Input,
  PageHeader,
  Modal,
  RadioGroup,
  RadioGroupItem,
  Select,
  Switch,
  Tag,
  Tooltip,
  WarningIcon,
} from "@nicecxone/lyra-ui";
import { readSimLatency, useProviderKind } from "@/provider-context";
import {
  EXTRA_HEADER_APPS,
  HOME_QUEUE_CHANNELS,
  PRESET_LABELS,
  SEAMS,
  useResetSettings,
  useSettings,
  useWorkspacePreset,
  type AgentChatDisplay,
  type AppDisplay,
  type AppPlacement,
  type ExtraHeaderApp,
  type HomeQueueChannel,
  type HomeSectionKey,
  type PhoneSetup,
  type PresetId,
  type SeamId,
} from "@/settings";

const EXTRA_APP_LABELS: Record<ExtraHeaderApp, string> = {
  customers: "Customers",
  accounts: "Accounts",
  tickets: "Tickets",
  wem: "WEM",
  schedule: "Schedule",
  screenpop: "Screen Pop",
};

// v3's per-app display options; Agent chat is a drawer, so it has no tab.
const APP_DISPLAY_OPTIONS = [
  { value: "tab", label: "Display in tab" },
  { value: "leftnav", label: "Display in Left Nav" },
  { value: "header", label: "Display in App Header" },
];
const AGENT_CHAT_DISPLAY_OPTIONS = APP_DISPLAY_OPTIONS.filter((o) => o.value !== "tab");

const SEAM_LABELS: Record<SeamId, string> = {
  phone: "Phone system",
  media: "Media (text-to-speech, speech recognition)",
  crm: "Customer data / CRM",
  tickets: "Tickets",
  email: "Email / marketing",
  wfm: "Workforce management / calendar",
  ai: "AI agent",
  knowledge: "Knowledge base",
  directory: "Address books",
  apps: "Apps",
};

const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  queue: "Queue",
  contactHistory: "Contact history",
  performance: "Performance",
  productivity: "Productivity",
};

// The queue tiles' names (`LATEST_CONTACTS_STATIC`).
const HOME_QUEUE_CHANNEL_LABELS: Record<HomeQueueChannel, string> = {
  digital: "Digital",
  inboundVoice: "Inbound Voice",
  voicemail: "Voicemail",
  workItem: "Work Item",
  outboundVoice: "Outbound Voice",
};

/** `items` with the entry at `index` swapped with its neighbor. */
function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const j = index + delta;
  if (j < 0 || j >= items.length) return items;
  const next = [...items];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

const VALID_STATION_ID = "12345";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-6 flex flex-col gap-3 first:mt-0">
      <legend className="mb-1 lyra-body-md-emphasis text-lyra-fg-default">{title}</legend>
      {children}
    </fieldset>
  );
}

/** A setting the workspace doesn't use yet: still toggleable, labeled. */
function Pending({ children }: { children: string }) {
  return <Tag variant="neutral" label={children} />;
}

function SwitchRow({
  label,
  checked,
  onCheckedChange,
  pending,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  pending?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch size="sm" label={label} checked={checked} onCheckedChange={onCheckedChange} />
      {pending && <Pending>{pending}</Pending>}
    </div>
  );
}

export function SettingsView({ showPageHeader = true }: { showPageHeader?: boolean }) {
  const [header, updateHeader] = useSettings("header");
  const [home, updateHome] = useSettings("home");
  const [assignments, updateAssignments] = useSettings("assignments");
  const [voice, updateVoice] = useSettings("voice");
  const [ai, updateAi] = useSettings("ai");
  const [phone, updatePhone] = useSettings("phone");
  const [appearance, updateAppearance] = useSettings("appearance");
  const [connections] = useSettings("connections");
  const { preset, pick } = useWorkspacePreset();
  const resetSettings = useResetSettings();
  const [resetOpen, setResetOpen] = React.useState(false);
  const providerKind = useProviderKind();

  const presetOptions = [
    { value: "phase1", label: PRESET_LABELS.phase1 },
    { value: "phase2", label: PRESET_LABELS.phase2 },
    ...(preset === "custom" ? [{ value: "custom", label: PRESET_LABELS.custom, disabled: true }] : []),
  ];

  const phoneDigits = phone.phoneNumber.replace(/\D/g, "").length;
  const phoneNumberError =
    phone.setup === "phone-number" && phone.phoneNumber !== "" && phoneDigits < 7
      ? "Phone number is not valid. Please enter a different number."
      : undefined;
  const stationIdError =
    phone.setup === "work-station" && phone.stationId !== "" && phone.stationId !== VALID_STATION_ID
      ? "Invalid Station ID"
      : undefined;

  return (
    <>
      {showPageHeader && (
        <PageHeader
          title="Settings"
          // In the header's action slot, reachable without scrolling; opens
          // the confirm dialog below.
          actions={
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              Reset to defaults
            </Button>
          }
        />
      )}
      <div className="flex-1 overflow-y-auto p-6" data-testid="settings-view">
        <Section title="Workspace preset">
          <div className="max-w-xs">
            <Select
              label="Preset"
              options={presetOptions}
              value={preset}
              onValueChange={(value) => {
                if (value === "phase1" || value === "phase2") pick(value as PresetId);
              }}
            />
          </div>
          <p className="lyra-body-sm text-lyra-fg-secondary">
            Phase 2 turns on the header apps (Customers, Accounts and Tickets as Home tabs; Schedule and WEM in the
            header) and the omnichannel layout. Changing any one of them shows Custom.
          </p>
        </Section>

        <Section title="Header">
          <SwitchRow
            label="Show app icons"
            checked={header.showAppIcons}
            onCheckedChange={(showAppIcons) => updateHeader({ showAppIcons })}
          />
          {header.showAppIcons && (
            <div className="ml-7 flex flex-col gap-3">
              <Checkbox label="Search" checked={header.search} onCheckedChange={(c) => updateHeader({ search: !!c })} />
              <div className="flex items-center gap-2">
                <Checkbox
                  label="Agent chat"
                  checked={header.agentChat.enabled}
                  onCheckedChange={(c) => updateHeader((prev) => ({ agentChat: { ...prev.agentChat, enabled: !!c } }))}
                />
                <Pending>Chat drawer arrives in P0.9.3</Pending>
              </div>
              {header.agentChat.enabled && (
                <div className="ml-7 max-w-xs">
                  <Select
                    label="Agent chat display"
                    options={AGENT_CHAT_DISPLAY_OPTIONS}
                    value={header.agentChat.placement}
                    onValueChange={(value) =>
                      updateHeader((prev) => ({
                        agentChat: { ...prev.agentChat, placement: value as AgentChatDisplay["placement"] },
                      }))
                    }
                  />
                </div>
              )}
              <Checkbox
                label="Notifications"
                checked={header.notifications}
                onCheckedChange={(c) => updateHeader({ notifications: !!c })}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  label="Apps grid"
                  checked={header.appsGrid}
                  onCheckedChange={(c) => updateHeader({ appsGrid: !!c })}
                />
                <Pending>Embedded apps arrive in P7.6</Pending>
              </div>
              {EXTRA_HEADER_APPS.map((app) => {
                const display = header.apps[app];
                const setDisplay = (patch: Partial<AppDisplay>) =>
                  updateHeader((prev) => ({ apps: { ...prev.apps, [app]: { ...prev.apps[app], ...patch } } }));
                return (
                  <React.Fragment key={app}>
                    <Checkbox
                      label={EXTRA_APP_LABELS[app]}
                      checked={display.enabled}
                      onCheckedChange={(c) => setDisplay({ enabled: !!c })}
                    />
                    {display.enabled && (
                      <div className="ml-7 flex items-end gap-2">
                        <div className="w-full max-w-xs">
                          <Select
                            label={`${EXTRA_APP_LABELS[app]} display`}
                            options={APP_DISPLAY_OPTIONS}
                            value={display.placement}
                            onValueChange={(value) => setDisplay({ placement: value as AppPlacement })}
                          />
                        </div>
                        {display.placement === "tab" && <Pending>Arrives in P0.5d.2</Pending>}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </Section>

        {/* v3's Settings → Home: the Dashboard's header and sections. */}
        <Section title="Home">
          <SwitchRow label="Show header" checked={home.showHeader} onCheckedChange={(showHeader) => updateHome({ showHeader })} />
          {home.showHeader && (
            <div className="max-w-sm">
              <Input
                label="Greeting"
                value={home.greeting}
                onChange={(e) => updateHome({ greeting: e.target.value })}
                placeholder="Hello"
              />
            </div>
          )}
          {home.showHeader && (
            <Checkbox
              label="Display agent first name"
              checked={home.showFirstName}
              onCheckedChange={(c) => updateHome({ showFirstName: c === true })}
            />
          )}
          {home.sections.map((section, index) => (
            <React.Fragment key={section.key}>
              <div className="flex max-w-sm items-center justify-between gap-2" data-home-section-row={section.key}>
                <Switch
                  size="sm"
                  label={HOME_SECTION_LABELS[section.key]}
                  checked={section.enabled}
                  onCheckedChange={(enabled) =>
                    updateHome((prev) => ({
                      sections: prev.sections.map((s) => (s.key === section.key ? { ...s, enabled } : s)),
                    }))
                  }
                />
                <div className="flex items-center gap-0.5">
                  <ActionIconButton
                    size="sm"
                    title={`Move ${HOME_SECTION_LABELS[section.key]} up`}
                    disabled={index === 0}
                    onClick={() => updateHome((prev) => ({ sections: moveItem(prev.sections, index, -1) }))}
                  >
                    <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
                  </ActionIconButton>
                  <ActionIconButton
                    size="sm"
                    title={`Move ${HOME_SECTION_LABELS[section.key]} down`}
                    disabled={index === home.sections.length - 1}
                    onClick={() => updateHome((prev) => ({ sections: moveItem(prev.sections, index, 1) }))}
                  >
                    <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
                  </ActionIconButton>
                </div>
              </div>
              {section.key === "queue" && section.enabled && (
                <div className="ml-7 flex flex-col gap-2">
                  {HOME_QUEUE_CHANNELS.map((channel) => (
                    <Checkbox
                      key={channel}
                      label={HOME_QUEUE_CHANNEL_LABELS[channel]}
                      checked={home.queue.channels[channel]}
                      onCheckedChange={(c) =>
                        updateHome((prev) => ({ queue: { channels: { ...prev.queue.channels, [channel]: c === true } } }))
                      }
                    />
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </Section>

        <Section title="Assignments">
          <SwitchRow
            label="Omnichannel layout"
            checked={assignments.omnichannel}
            onCheckedChange={(omnichannel) => updateAssignments({ omnichannel })}
            pending="Arrives in P2.2"
          />
          <SwitchRow
            label="New Outbound at the bottom"
            checked={assignments.newOutboundAtBottom}
            onCheckedChange={(newOutboundAtBottom) => updateAssignments({ newOutboundAtBottom })}
          />
          <SwitchRow
            label="Home and Settings at the top"
            checked={assignments.navItemsAtTop}
            onCheckedChange={(navItemsAtTop) => updateAssignments({ navItemsAtTop })}
          />
          <SwitchRow
            label="Don't allow interactions to collapse"
            checked={assignments.noInteractionCollapse}
            onCheckedChange={(noInteractionCollapse) => updateAssignments({ noInteractionCollapse })}
          />
        </Section>

        <Section title="Voice">
          <div className="max-w-xs">
            <Select
              label="Voice controls location"
              options={[
                { value: "bottom", label: "Bottom" },
                { value: "top", label: "Top of left nav" },
              ]}
              value={voice.controlsLocation}
              onValueChange={(value) => updateVoice({ controlsLocation: value as typeof voice.controlsLocation })}
            />
          </div>
        </Section>

        <Section title="AI">
          <div className="max-w-xs">
            <Select
              label="AI display"
              options={[
                { value: "inline", label: "Inline in the transcript" },
                { value: "panel", label: "In the Contact Details panel" },
              ]}
              value={ai.displayLocation}
              onValueChange={(value) => updateAi({ displayLocation: value as typeof ai.displayLocation })}
            />
          </div>
        </Section>

        <Section title="Phone setup">
          <div className="flex items-center gap-2">
            <Pending>Used by the launch screen; a real phone system reads it with its adapter</Pending>
          </div>
          <RadioGroup
            label="Phone setup"
            value={phone.setup}
            onValueChange={(value) => updatePhone({ setup: value as PhoneSetup })}
          >
            <RadioGroupItem value="soft-phone" label="Integrated Soft Phone" />
            <RadioGroupItem value="phone-number" label="Phone Number" />
            <RadioGroupItem value="work-station" label="Station ID" />
          </RadioGroup>
          {phone.setup === "phone-number" && (
            <div className="max-w-xs">
              <Input
                label="Phone number"
                type="tel"
                value={phone.phoneNumber}
                onChange={(e) => updatePhone({ phoneNumber: e.target.value })}
                error={phoneNumberError}
              />
            </div>
          )}
          {phone.setup === "work-station" && (
            <div className="max-w-xs">
              <Input
                label="Station ID"
                value={phone.stationId}
                onChange={(e) => updatePhone({ stationId: e.target.value })}
                error={stationIdError}
              />
            </div>
          )}
        </Section>

        <Section title="Appearance">
          <SwitchRow
            label="Dark mode"
            checked={appearance.theme === "dark"}
            onCheckedChange={(dark) => updateAppearance({ theme: dark ? "dark" : "light" })}
          />
        </Section>

        <Section title="Connections">
          <p className="lyra-body-sm text-lyra-fg-secondary">
            Every seam runs on the simulator until its real adapter exists.
            {providerKind === "sim" &&
              ` Simulated latency: ${readSimLatency(window.location.search, import.meta.env.DEV)}.`}
          </p>
          <div className="flex flex-col divide-y divide-lyra-border-soft rounded-lyra-md border border-lyra-border-soft">
            {SEAMS.map((seam) => (
              <div key={seam} className="flex flex-wrap items-center gap-3 px-4 py-3" data-seam={seam}>
                <span className="min-w-[12rem] flex-1 lyra-body-md text-lyra-fg-default">{SEAM_LABELS[seam]}</span>
                <Badge shape="pill" color="info" variant="subtle" fontSize={12}>
                  {connections.seams[seam].mode === "simulated" ? "Simulated" : connections.seams[seam].mode}
                </Badge>
                <div className="w-56">
                  <Input aria-label={`${SEAM_LABELS[seam]} endpoint`} placeholder="Endpoint" disabled />
                </div>
                <Tooltip content="Available when this seam has a real adapter" placement="bottom">
                  <span className="inline-flex gap-2">
                    <Button variant="outline" disabled>
                      Test
                    </Button>
                    <Button disabled>Save</Button>
                  </span>
                </Tooltip>
              </div>
            ))}
          </div>
        </Section>

        {/* lyra `Modal` as an alert dialog — same shape as its "Alert Dialog
            (Destructive)" story (Modal.variants.stories.tsx): header title +
            warning icon, footer buttons through `footerActions` (lyra's
            `ContainerFooter` spaces them), focus starting on Cancel
            (`data-modal-cancel`). The body wrapper and the 360px width are
            the story's own (`ToneContent`, `widths.sm`): `Modal` has no body
            slot of its own. */}
        <Modal
          open={resetOpen}
          onClose={() => setResetOpen(false)}
          closeOnBackdropClick
          alert
          description="Every setting on this page goes back to its default."
          headerTitle="Reset to defaults?"
          headerIcon={<WarningIcon className="h-5 w-5" />}
          footerActions={
            <>
              <Button variant="outline" data-modal-cancel onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  resetSettings();
                  setResetOpen(false);
                }}
              >
                Reset
              </Button>
            </>
          }
          className="w-[360px]"
        >
          <div className="flex flex-col gap-2 px-5 pb-2">
            <p className="lyra-body-md text-lyra-fg-default">
              Every setting on this page goes back to its default (Phase 1). This can't be undone.
            </p>
          </div>
        </Modal>
      </div>
    </>
  );
}
