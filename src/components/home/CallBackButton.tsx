// "Call back" on a completed voice contact in the feed's History (P-HOME-1):
// the Phase 2 Home side panel's Redial, folded into the row. Same handler and
// rules as Contact History's Redial: hidden while Outbound Calling → Redial
// is off, disabled with the reason until the agent can call.
import { Button } from "@nicecxone/lyra-ui";
import { PhoneOutgoing } from "lucide-react";
import type { ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { t } from "@/i18n";

export function CallBackButton({ entry }: { entry: ContactHistoryEntry }) {
  const { calling, outboundDial, handleRedialButtonClick } = useWorkspace();
  if (!entry.redial || !calling.redial) return null;
  const reason = outboundDial.redialBlockedReason(entry);
  return (
    <DisabledReason reason={reason}>
      <Button
        variant="outline"
        size="sm"
        disabled={!!reason}
        onClick={(e) => {
          // The row behind it reopens the contact; Call back only dials.
          e.stopPropagation();
          handleRedialButtonClick(entry, e.currentTarget);
        }}
      >
        <PhoneOutgoing className="h-3.5 w-3.5" strokeWidth={1.5} />
        {t("Call back")}
      </Button>
    </DisabledReason>
  );
}
