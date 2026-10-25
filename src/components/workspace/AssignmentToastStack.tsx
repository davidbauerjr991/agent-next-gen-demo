// Toasts for events on other assignments (P-HOME-1): lyra `Toast`s with the
// person's avatar, the channel or kind chip, one line, View and Dismiss.
// Newest on top, three at a time, then "+N more" (the Notifications drawer,
// where every toast is also a row). Approvals stay until acted on.
import { Avatar, Button, Tag, Toast } from "@nicecxone/lyra-ui";
import { KindTag } from "@/components/home/home-kinds";
import { CHANNEL_NAMES } from "@/contact-handling/home/channel-names";
import { initialsOf, toastStack } from "@/contact-handling/toasts/assignment-toasts";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useSettings } from "@/settings";
import { t } from "@/i18n";

export function AssignmentToastStack() {
  const [toasts] = useWorkspaceUiField("assignmentToasts");
  const { assignmentToasts, handlePanelButtonClick } = useWorkspace();
  const [{ toasts: settings }] = useSettings("notifications");
  if (!settings.enabled) return null;
  const { shown, more } = toastStack(toasts);
  return (
    <>
      {shown.map((toast) => (
        <Toast
          key={toast.id}
          data-assignment-toast={toast.event}
          variant={toast.urgent ? "warning" : "info"}
          title={toast.name}
          leading={<Avatar initials={initialsOf(toast.name)} size="sm" />}
          duration={toast.urgent ? 0 : settings.duration * 1000}
          actionLabel={t("View")}
          onAction={() => assignmentToasts.view(toast)}
          onDismiss={() => assignmentToasts.dismiss(toast.id)}
        >
          <span className="flex flex-col items-start gap-1">
            {toast.channel ? <Tag shape="pill" variant="teal" label={t(CHANNEL_NAMES[toast.channel])} /> : <KindTag kind={toast.kind} />}
            <span className="line-clamp-1">{toast.line}</span>
          </span>
        </Toast>
      ))}
      {more > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="rounded-full bg-lyra-bg-surface-overlay shadow-lg"
          onClick={handlePanelButtonClick("notif")}
          data-assignment-toast-more=""
        >
          {t("+{count} more", { count: more })}
        </Button>
      )}
    </>
  );
}
