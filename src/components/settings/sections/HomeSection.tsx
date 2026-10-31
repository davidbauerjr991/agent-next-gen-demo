// Settings → Home (v3's Settings → Home; P-HOME-1n grouping): the welcome header, the sections and their order, the
// Activity view. Home layout itself is under Settings → Layout.
import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ActionIconButton, Checkbox, Input, RadioGroup, RadioGroupItem, Switch, Tag } from "@nicecxone/lyra-ui";
import { homeIsTwoColumn } from "@/contact-handling/home/home-layout";
import { t } from "@/i18n";
import {
  HOME_ACTIVITY_VIEWS,
  HOME_ACTIVITY_VIEW_FIELD,
  HOME_QUEUE_CHANNELS,
  useSectionLocked,
  useSettings,
  type HomeActivityView,
  type HomeQueueChannel,
  type HomeSectionKey,
} from "@/settings";
import { LockScope, Section, SettingsGroup, SwitchRow } from "../settings-parts";

const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  queue: "Queue",
  contactHistory: "Contact history",
  performance: "Performance",
  productivity: "Productivity",
  activity: "Activity",
  dueSoon: "Due soon",
  teamQueues: "Team queues",
  teamToday: "Team today",
  needsYou: "Needs you",
  pipeline: "Pipeline",
  campaignToday: "Campaign today",
  followUps: "Follow-ups",
};

const HOME_ACTIVITY_VIEW_LABELS: Record<HomeActivityView, string> = {
  list: "List",
  table: "Table",
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

export function HomeSection() {
  const [home, updateHome] = useSettings("home");
  const [{ parts }] = useSettings("layout");
  // The sections' order is their parts' order: the `layout` lock holds it (the switches stay the agent's).
  const orderLocked = useSectionLocked("layout");
  return (
    <SettingsGroup id="home" title={t("Home")} lockKey="home">
      <Section title={t("Welcome header")}>
        <SwitchRow label="Show header" checked={home.showHeader} onCheckedChange={(showHeader) => updateHome({ showHeader })} />
        {home.showHeader && (
          <div className="max-w-sm">
            <Input label="Greeting" value={home.greeting} onChange={(e) => updateHome({ greeting: e.target.value })} placeholder="Hello" />
          </div>
        )}
        {home.showHeader && (
          <Checkbox label="Display agent first name" checked={home.showFirstName} onCheckedChange={(c) => updateHome({ showFirstName: c === true })} />
        )}
      </Section>

      <Section title={t("Sections")}>
        {orderLocked && (
          <div>
            <Tag variant="neutral" label={t("Order set by your team profile")} />
          </div>
        )}
        {home.sections.map((section, index) => (
          <React.Fragment key={section.key}>
            <div className="flex max-w-sm items-center justify-between gap-2" data-home-section-row={section.key}>
              {section.key === "contactHistory" && homeIsTwoColumn(home, parts) ? (
                // P-HOME-1e: two-column Home's feed has a History view that is Contact History.
                <span className="flex flex-col" data-home-section-in-feed="">
                  <span className="lyra-body-md text-lyra-fg-default">{HOME_SECTION_LABELS[section.key]}</span>
                  <span className="lyra-body-sm text-lyra-fg-secondary">{t("Shown in the Activity feed's History view")}</span>
                </span>
              ) : (
                <Switch
                  size="sm"
                  label={HOME_SECTION_LABELS[section.key]}
                  checked={section.enabled}
                  onCheckedChange={(enabled) =>
                    updateHome((prev) => ({ sections: prev.sections.map((s) => (s.key === section.key ? { ...s, enabled } : s)) }))
                  }
                />
              )}
              <div className="flex items-center gap-0.5">
                <ActionIconButton
                  size="sm"
                  title={`Move ${HOME_SECTION_LABELS[section.key]} up`}
                  disabled={index === 0 || orderLocked}
                  onClick={() => updateHome((prev) => ({ sections: moveItem(prev.sections, index, -1) }))}
                >
                  <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
                </ActionIconButton>
                <ActionIconButton
                  size="sm"
                  title={`Move ${HOME_SECTION_LABELS[section.key]} down`}
                  disabled={index === home.sections.length - 1 || orderLocked}
                  onClick={() => updateHome((prev) => ({ sections: moveItem(prev.sections, index, 1) }))}
                >
                  <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
                </ActionIconButton>
              </div>
            </div>
            {section.key === "queue" && section.enabled && (
              <div className="ms-7 flex flex-col gap-2">
                {HOME_QUEUE_CHANNELS.map((channel) => (
                  <Checkbox
                    key={channel}
                    label={HOME_QUEUE_CHANNEL_LABELS[channel]}
                    checked={home.queue.channels[channel]}
                    onCheckedChange={(c) => updateHome((prev) => ({ queue: { channels: { ...prev.queue.channels, [channel]: c === true } } }))}
                  />
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
      </Section>

      <Section title={t("Activity view")}>
        {/* The Activity feed's `view` option (also a preset in Settings → Layout): the `layout` lock makes it read-only too. */}
        <LockScope lockKey="layout">
          <RadioGroup
            label={t(HOME_ACTIVITY_VIEW_FIELD.meta!.label)}
            labelHelpText={t(HOME_ACTIVITY_VIEW_FIELD.meta!.description)}
            value={home.activityView}
            onValueChange={(value) => updateHome({ activityView: value as HomeActivityView })}
            data-setting="home.activityView"
          >
            {HOME_ACTIVITY_VIEWS.map((view) => (
              <RadioGroupItem key={view} value={view} label={t(HOME_ACTIVITY_VIEW_LABELS[view])} />
            ))}
          </RadioGroup>
        </LockScope>
      </Section>
    </SettingsGroup>
  );
}
