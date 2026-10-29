// A setting another setting forces (`SETTING_CONSTRAINTS`, P-HOME-1n): shown disabled at its forced value, with the
// reason in a tooltip and as visible text (the rule's note, "On — required while …", else its reason); never hidden.
// No constraint: the control alone.
import type { ReactNode } from "react";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import { t } from "@/i18n";
import { useConstraint, type SettingPath } from "@/settings";

/** Wraps a control the caller disabled while `useConstraint(path)` holds: the reason on hover, and the rule's note
 *  beneath. */
export function ConstrainedSetting({ path, children }: { path: SettingPath; children: ReactNode }) {
  const rule = useConstraint(path);
  if (!rule) return <>{children}</>;
  // Always visible text (a disabled control can't take focus, so its tooltip alone never reaches a keyboard or screen
  // reader user): the rule's note, else its reason.
  return (
    <div className="flex flex-col gap-1" data-forced-setting={path}>
      <DisabledReason reason={t(rule.reason)}>{children}</DisabledReason>
      <p className="ms-7 lyra-body-sm text-lyra-fg-secondary">{t(rule.note ?? rule.reason)}</p>
    </div>
  );
}
