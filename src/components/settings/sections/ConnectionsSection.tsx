// Settings → Connections: one integration per seam, simulated until its real adapter exists.
import { Badge, Button, Input, Tooltip } from "@nicecxone/lyra-ui";
import { readSimLatency, useProviderKind } from "@/provider-context";
import { SEAMS, useSettings, type SeamId } from "@/settings";
import { t } from "@/i18n";
import { SettingsGroup } from "../settings-parts";

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

export function ConnectionsSection() {
  const [connections] = useSettings("connections");
  const providerKind = useProviderKind();
  return (
    <SettingsGroup id="connections" title={t("Connections")} lockKey="connections">
      <p className="lyra-body-sm text-lyra-fg-secondary">
        Every seam runs on the simulator until its real adapter exists.
        {providerKind === "sim" && ` Simulated latency: ${readSimLatency(window.location.search, import.meta.env.DEV)}.`}
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
    </SettingsGroup>
  );
}
