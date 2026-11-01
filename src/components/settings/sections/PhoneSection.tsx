// Settings → Phone (P-HOME-1n grouping): the agent's phone setup (personal scope; the launch screen reads it). The
// voice controls' location, once under Settings → Voice, is a Layout preset only (P-LAYOUT-F1 E).
import { Input, RadioGroup, RadioGroupItem } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import { useSettings, type PhoneSetup } from "@/settings";
import { Pending, SettingsGroup } from "../settings-parts";

const VALID_STATION_ID = "12345";

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
