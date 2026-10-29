// Settings → Channels (P-HOME-1n grouping): the contact channels, the social placeholders (admin scope) and New
// Outbound (CXone's agent settings, by their names: the CXone adapter maps them 1:1).
import { t } from "@/i18n";
import { useInteractions } from "@/provider-context";
import {
  CONTACT_CHANNELS,
  LAUNCHER_TABS,
  OUTBOUND_CALLING,
  SOCIAL_CHANNELS,
  useSettings,
  type ContactChannel,
  type LauncherTab,
  type OutboundCalling,
  type SocialChannel,
} from "@/settings";
import { CheckboxRow, Pending, Section, SettingsGroup, SwitchRow } from "../settings-parts";

const CHANNEL_LABELS: Record<ContactChannel, string> = {
  voice: "Voice",
  chat: "Chat",
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

const SOCIAL_CHANNEL_LABELS: Record<SocialChannel, string> = {
  messenger: "Messenger",
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
  telegram: "Telegram",
  wechat: "WeChat",
  appleMessages: "Apple Messages for Business",
  googleBusiness: "Google Business Messages",
};

// CXone's Directory App tabs (Dial Pad is ours).
const LAUNCHER_TAB_LABELS: Record<LauncherTab, string> = {
  dialpad: "Dial Pad",
  search: "Search",
  all: "All",
  favorites: "Favorites",
  agents: "Agents",
  skills: "Skills",
  teams: "Teams",
  addressBook: "Address Book",
};
const LAUNCHER_TAB_PENDING: Partial<Record<LauncherTab, string>> = {
  search: "Built into every tab",
  agents: "Arrives in P0.9",
  skills: "Arrives in P0.9",
  teams: "Arrives in P0.9",
};

// CXone's Outbound Calling permissions.
const OUTBOUND_CALLING_LABELS: Record<OutboundCalling, string> = {
  adHoc: "Ad-hoc",
  redial: "Redial",
  agent: "Agent",
  addressBook: "Address Book",
  skill: "Skill",
  elevation: "Elevation",
  saveAndRedial: "Save and Redial",
  transfer: "Transfer",
};
const OUTBOUND_CALLING_PENDING: Partial<Record<OutboundCalling, string>> = {
  agent: "Arrives in P0.9",
  addressBook: "Arrives in P0.9",
  skill: "Arrives in P0.9",
  transfer: "Arrives in P0.9",
};

export function ChannelsSection() {
  const [channels, updateChannels] = useSettings("channels");
  const [outbound, updateOutbound] = useSettings("outbound");
  const callInProgress = useInteractions().some(
    (i) => i.channel === "voice" && (i.state === "connecting" || i.state === "active" || i.state === "held"),
  );
  return (
    <SettingsGroup id="channels" title={t("Channels")}>
      {/* The channels agents contact customers on. Voice can't be turned off during a call: its switch gives way to a note. */}
      <Section title={t("Contact channels")} lockKey="channels">
        {CONTACT_CHANNELS.map((channel) =>
          channel === "voice" && channels.voice && callInProgress ? (
            <div key={channel} className="flex items-center gap-2" data-channel-row={channel}>
              <span className="lyra-body-md text-lyra-fg-default">{CHANNEL_LABELS[channel]}</span>
              <Pending>A call is in progress</Pending>
            </div>
          ) : (
            <SwitchRow
              key={channel}
              label={CHANNEL_LABELS[channel]}
              checked={channels[channel]}
              onCheckedChange={(on) => updateChannels({ [channel]: on })}
            />
          ),
        )}
      </Section>
      {/* Placeholders until P2.7's channel registry: stored, nothing else. */}
      <div data-setting="social-channels">
        <Section title={t("Social")} tag={t("Admin")} lockKey="channels">
          {SOCIAL_CHANNELS.map((channel) => (
            <SwitchRow
              key={channel}
              label={SOCIAL_CHANNEL_LABELS[channel]}
              checked={channels.social[channel]}
              onCheckedChange={(on) => updateChannels((prev) => ({ social: { ...prev.social, [channel]: on } }))}
              pending="Arrives in P2.7"
            />
          ))}
        </Section>
      </div>
      <Section title={t("New Outbound")} lockKey="outbound">
        <CheckboxRow
          legend="Directory App"
          items={LAUNCHER_TABS.map((tab) => ({
            key: tab,
            label: LAUNCHER_TAB_LABELS[tab],
            checked: outbound.launcher[tab],
            pending: LAUNCHER_TAB_PENDING[tab],
          }))}
          onChange={(tab, checked) => updateOutbound((prev) => ({ launcher: { ...prev.launcher, [tab]: checked } }))}
        />
        <CheckboxRow
          legend="Outbound Calling"
          items={OUTBOUND_CALLING.map((behavior) => ({
            key: behavior,
            label: OUTBOUND_CALLING_LABELS[behavior],
            checked: outbound.calling[behavior],
            pending: OUTBOUND_CALLING_PENDING[behavior],
          }))}
          onChange={(behavior, checked) => updateOutbound((prev) => ({ calling: { ...prev.calling, [behavior]: checked } }))}
        />
      </Section>
    </SettingsGroup>
  );
}
