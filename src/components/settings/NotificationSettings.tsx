// Settings → Notifications (P-HOME-1): toasts for events on assignments other
// than the active one, rendered from the `notifications` section's
// declarations. Off means no toasts at all, and nothing below is shown.
import { Checkbox, RadioGroup, RadioGroupItem, Switch } from "@nicecxone/lyra-ui";
import {
  TOAST_DURATION_FIELD,
  TOAST_EVENTS_RAISED,
  TOAST_EVENT_FIELDS,
  TOAST_POSITIONS,
  TOAST_POSITION_FIELD,
  TOAST_QUIET_ON_VOICE_FIELD,
  useConstraint,
  useSettings,
  type ToastPosition,
  type ToastSettings,
} from "@/settings";
import { t } from "@/i18n";
import { IntSettingInput } from "./IntSettingInput";
import { ConstrainedSetting } from "./ConstrainedSetting";

const POSITION_LABELS: Record<ToastPosition, string> = { bottomEnd: "Bottom", topEnd: "Top" };

export function NotificationSettings() {
  const [{ toasts }, update] = useSettings("notifications");
  const setToasts = (patch: Partial<ToastSettings>) => update((prev) => ({ toasts: { ...prev.toasts, ...patch } }));
  const enabledForced = !!useConstraint("notifications.toasts.enabled");
  const incomingForced = !!useConstraint("notifications.toasts.events.incoming");
  return (
    <div className="flex flex-col gap-4" data-settings="notifications">
      <ConstrainedSetting path="notifications.toasts.enabled">
        <Switch
          size="sm"
          label={t("Toasts for other assignments")}
          labelHelpText={t("A new message, an approval request or a callback coming due on an assignment you're not looking at.")}
          checked={toasts.enabled}
          disabled={enabledForced}
          onCheckedChange={(enabled) => setToasts({ enabled })}
        />
      </ConstrainedSetting>
      {toasts.enabled && (
        <div className="ms-7 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {TOAST_EVENTS_RAISED.map((event) => {
              const box = (
                <Checkbox
                  key={event}
                  label={t(TOAST_EVENT_FIELDS[event].label)}
                  checked={toasts.events[event]}
                  disabled={event === "incoming" && incomingForced}
                  onCheckedChange={(c) => setToasts({ events: { ...toasts.events, [event]: c === true } })}
                />
              );
              return event === "incoming" ? (
                <ConstrainedSetting key={event} path="notifications.toasts.events.incoming">
                  {box}
                </ConstrainedSetting>
              ) : (
                box
              );
            })}
          </div>
          <div className="max-w-xs">
            <IntSettingInput field={TOAST_DURATION_FIELD} step={1} value={toasts.duration} onCommit={(duration) => setToasts({ duration })} />
          </div>
          <Switch
            size="sm"
            label={t(TOAST_QUIET_ON_VOICE_FIELD.label)}
            labelHelpText={t(TOAST_QUIET_ON_VOICE_FIELD.description)}
            checked={toasts.quietOnVoice}
            onCheckedChange={(quietOnVoice) => setToasts({ quietOnVoice })}
          />
          <RadioGroup
            label={t(TOAST_POSITION_FIELD.meta!.label)}
            labelHelpText={t(TOAST_POSITION_FIELD.meta!.description)}
            orientation="horizontal"
            value={toasts.position}
            onValueChange={(value) => setToasts({ position: value as ToastPosition })}
          >
            {TOAST_POSITIONS.map((p) => (
              <RadioGroupItem key={p} value={p} label={t(POSITION_LABELS[p])} />
            ))}
          </RadioGroup>
        </div>
      )}
    </div>
  );
}
