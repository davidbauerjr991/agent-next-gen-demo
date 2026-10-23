// The Workspace profile section's dialogs (P-PROFILES): name (Save as /
// Rename), delete, locks and the import result. Each is lyra's `Modal`, shaped
// like the Settings page's Reset dialog (header title, body, `footerActions`).
import * as React from "react";
import { Button, Checkbox, InlineNotification, Input, Modal, WarningIcon } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import { profileSectionKeys, type ProfileImportError, type ProfileReadWarning, type SectionKey } from "@/settings";
import { SECTION_TITLES } from "./section-titles";

const IMPORT_ERRORS: Record<ProfileImportError, string> = {
  malformed: "This file isn't valid JSON.",
  notAProfile: "This file isn't a workspace profile.",
  newerFormat: "This profile was exported by a newer version of the workspace.",
};

/** Save as / Rename: a name field; the confirm button is off while it's empty. */
export function ProfileNameDialog({
  open,
  title,
  confirmLabel,
  initialName,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  initialName: string;
  /** Returns false when the name was refused. */
  onConfirm: (name: string) => boolean;
  onClose: () => void;
}) {
  const [name, setName] = React.useState(initialName);
  React.useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);
  const submit = () => {
    if (name.trim() && onConfirm(name)) onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdropClick
      headerTitle={title}
      footerActions={
        <>
          <Button variant="outline" data-modal-cancel onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button disabled={!name.trim()} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
      className="w-[360px]"
    >
      <form
        className="flex flex-col gap-2 px-5 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input label={t("Profile name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </form>
    </Modal>
  );
}

export function DeleteProfileDialog({
  open,
  name,
  onConfirm,
  onClose,
}: {
  open: boolean;
  name: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdropClick
      alert
      description={t("{name} is deleted from this browser.", { name })}
      headerTitle={t("Delete profile?")}
      headerIcon={<WarningIcon className="h-5 w-5" />}
      footerActions={
        <>
          <Button variant="outline" data-modal-cancel onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {t("Delete")}
          </Button>
        </>
      }
      className="w-[360px]"
    >
      <div className="flex flex-col gap-2 px-5 pb-2">
        <p className="lyra-body-md text-lyra-fg-default">
          {t("{name} is deleted from this browser. Your current settings stay as they are. This can't be undone.", { name })}
        </p>
      </div>
    </Modal>
  );
}

/** Which sections render read-only once the profile is applied. */
export function ProfileLocksDialog({
  open,
  name,
  locks,
  onSave,
  onClose,
}: {
  open: boolean;
  name: string;
  locks: SectionKey[];
  onSave: (locks: SectionKey[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = React.useState<SectionKey[]>(locks);
  React.useEffect(() => {
    if (open) setDraft(locks);
  }, [open, locks]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdropClick
      headerTitle={t("Locks for {name}", { name })}
      footerActions={
        <>
          <Button variant="outline" data-modal-cancel onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            {t("Save")}
          </Button>
        </>
      }
      className="w-[400px]"
    >
      <div className="flex flex-col gap-3 px-5 pb-2" data-slot="profile-locks">
        <p className="lyra-body-md text-lyra-fg-default">
          {t("A locked section is read-only in Settings once this profile is applied (\"Set by your team profile\").")}
        </p>
        {profileSectionKeys().map((key) => (
          <Checkbox
            key={key}
            label={t(SECTION_TITLES[key])}
            checked={draft.includes(key)}
            onCheckedChange={(c) => setDraft((d) => (c === true ? [...d, key] : d.filter((k) => k !== key)))}
          />
        ))}
      </div>
    </Modal>
  );
}

export type ImportOutcome =
  | { ok: true; name: string; warnings: ProfileReadWarning[] }
  | { ok: false; error: ProfileImportError };

export function ImportResultDialog({
  outcome,
  onApply,
  onClose,
}: {
  outcome: ImportOutcome | null;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={outcome !== null}
      onClose={onClose}
      closeOnBackdropClick
      headerTitle={outcome?.ok ? t("Profile imported") : t("Couldn't import the profile")}
      footerActions={
        outcome?.ok ? (
          <>
            <Button variant="outline" data-modal-cancel onClick={onClose}>
              {t("Close")}
            </Button>
            <Button
              onClick={() => {
                onApply();
                onClose();
              }}
            >
              {t("Apply")}
            </Button>
          </>
        ) : (
          <Button variant="outline" data-modal-cancel onClick={onClose}>
            {t("Close")}
          </Button>
        )
      }
      className="w-[400px]"
    >
      <div className="flex flex-col gap-3 px-5 pb-2" data-slot="profile-import-result">
        {outcome?.ok ? (
          <>
            <p className="lyra-body-md text-lyra-fg-default">{t("{name} was added to your saved profiles.", { name: outcome.name })}</p>
            {outcome.warnings.length > 0 && (
              <InlineNotification variant="warning">
                {t("Some sections used their defaults:")}{" "}
                {outcome.warnings
                  .map((w) =>
                    w.reason === "version"
                      ? t("{section} (saved with another version)", { section: t(SECTION_TITLES[w.section]) })
                      : t("{section} (missing)", { section: t(SECTION_TITLES[w.section]) }),
                  )
                  .join(", ")}
              </InlineNotification>
            )}
          </>
        ) : (
          outcome && <InlineNotification variant="error">{t(IMPORT_ERRORS[outcome.error])}</InlineNotification>
        )}
      </div>
    </Modal>
  );
}
