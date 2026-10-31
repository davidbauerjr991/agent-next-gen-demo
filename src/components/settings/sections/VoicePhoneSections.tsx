// Settings → Voice and → Phone (P-HOME-1n grouping): the voice controls' location, and the agent's phone setup
// (personal scope; the launch screen reads it).
import { Input, RadioGroup, RadioGroupItem, Select } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import { useSettings, type PhoneSetup } from "@/settings";
import { LockScope, Pending, SettingsGroup } from "../settings-parts";

const VALID_STATION_ID = "12345";

export function VoiceSection() {
  const [voice, updateVoice] = useSettings("voice");
  return (
    <SettingsGroup id="voice" title={t("Voice")} lockKey="voice">
      {/* A placement (the voice bar's slot; also a preset in Settings → Layout): the `layout` lock makes it read-only too. */}
      <LockScope lockKey="layout">
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
      </LockScope>
    </SettingsGroup>
  );
}

export function PhoneSection() {
  const [phone, updatePhone] = useSettings("phone");
  const phoneDigits = phone.phoneNumber.replace(/\D/g, "").length;
  const phoneNumberError =
    phone.setup === "phone-number" && phone.phoneNumber !== "" && phoneDigits < 7
      ? "Phone number is not valid. Please enter a different number."
      : undefined;
  const stationIdError =
    phone.setup === "work-station" && phone.stationId !== "" && phone.stationId !== VALID_STATION_ID ? "Invalid Station ID" : undefined;
  return (
    <SettingsGroup id="phone" title={t("Phone")}>
      <div className="flex items-center gap-2">
        <Pending>Used by the launch screen; a real phone system reads it with its adapter</Pending>
      </div>
      <RadioGroup label="Phone setup" value={phone.setup} onValueChange={(value) => updatePhone({ setup: value as PhoneSetup })}>
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
          <Input label="Station ID" value={phone.stationId} onChange={(e) => updatePhone({ stationId: e.target.value })} error={stationIdError} />
        </div>
      )}
    </SettingsGroup>
  );
}
