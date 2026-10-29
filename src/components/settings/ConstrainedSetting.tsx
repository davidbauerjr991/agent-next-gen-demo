// A setting another setting forces (`SETTING_CONSTRAINTS`, P-HOME-1n): shown disabled at its forced value, with the
// reason in a tooltip and, when the rule declares one, a visible note ("On — required while …"); never hidden. No
// constraint: the control alone.
import type { ReactNode } from "react";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import { t } from "@/i18n";
import { useConstraint, type SettingPath } from "@/settings";

/** Wraps a control the caller disabled while `useConstraint(path)` holds: the reason on hover, and the rule's note
 *  beneath. */
export function ConstrainedSetting({ path, children }: { path: SettingPath; children: ReactNode }) {
  const rule = useConstraint(path);
  if (!rule) return <>{children}</>;
  return (
    <div className="flex flex-col gap-1" data-forced-setting={path}>
      <DisabledReason reason={t(rule.reason)}>{children}</DisabledReason>
      {rule.note && <p className="ms-7 lyra-body-sm text-lyra-fg-secondary">{t(rule.note)}</p>}
    </div>
  );
}
