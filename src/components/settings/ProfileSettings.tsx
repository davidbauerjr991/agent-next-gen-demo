// Settings → Workspace profile (P-PROFILES): the picker lists the built-in and
// saved profiles ("<name> · modified" once the settings move off the picked
// one, "Custom" when they match none and came from none), with Save (a saved
// profile; disabled for a built-in), Discard changes, Save as, Import, and a kebab for the picked profile (Rename, Duplicate,
// Locks, Export, Delete; built-ins can only be duplicated and exported).
import * as React from "react";
import { Button, KebabMenuButton, Select } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import {
  PROFILE_IDS,
  PROFILE_LABELS,
  isSavedProfileId,
  useWorkspaceProfile,
  type ProfileId,
  type SavedProfileId,
} from "@/settings";
import {
  DeleteProfileDialog,
  ImportResultDialog,
  ProfileLocksDialog,
  ProfileNameDialog,
  type ImportOutcome,
} from "./ProfileDialogs";

type Dialog = "saveAs" | "rename" | "delete" | "locks" | null;

/** Offers `json` as a file download. */
function downloadJson(fileName: string, json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const fileNameFor = (name: string) => `${name.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "profile"}.profile.json`;

export function ProfileSettings() {
  const api = useWorkspaceProfile();
  const { profile, modified, saved } = api;
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [importOutcome, setImportOutcome] = React.useState<ImportOutcome | null>(null);
  const [importedId, setImportedId] = React.useState<SavedProfileId | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const current = isSavedProfileId(profile) ? saved.find((p) => p.id === profile) : undefined;
  const currentName = current ? current.name : profile === "custom" ? "" : PROFILE_LABELS[profile as ProfileId];

  // Off its values, the picked profile reads "<name> · modified".
  const labelFor = (id: string, name: string) => (modified && id === profile ? t("{name} · modified", { name }) : name);
  const options = [
    ...PROFILE_IDS.map((id) => ({ value: id, label: labelFor(id, t(PROFILE_LABELS[id])), group: t("Built-in") })),
    ...saved.map((p) => ({ value: p.id, label: labelFor(p.id, p.name), group: t("Saved") })),
    ...(profile === "custom" ? [{ value: "custom", label: t(PROFILE_LABELS.custom), disabled: true }] : []),
  ];

  const menuItems = profile === "custom"
    ? []
    : [
        ...(current ? [{ id: "rename", label: t("Rename…"), onClick: () => setDialog("rename") }] : []),
        { id: "duplicate", label: t("Duplicate"), onClick: () => api.duplicate(profile as ProfileId | SavedProfileId) },
        ...(current ? [{ id: "locks", label: t("Locks…"), onClick: () => setDialog("locks") }] : []),
        {
          id: "export",
          label: t("Export"),
          onClick: () => {
            const file = api.exportFile(profile as ProfileId | SavedProfileId);
            if (file) downloadJson(fileNameFor(file.name), file.json);
          },
        },
        ...(current ? (["separator", { id: "delete", label: t("Delete…"), onClick: () => setDialog("delete") }] as const) : []),
      ];

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = api.importFile(await file.text());
    if (result.ok) {
      setImportedId(result.profile.id);
      setImportOutcome({ ok: true, name: result.profile.name, warnings: result.warnings });
    } else {
      setImportedId(null);
      setImportOutcome(result);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full max-w-xs">
          {/* Named by its sub-group's title, which says the same (P-POLISH 6). */}
          <Select
            aria-label={t("Workspace profile")}
            options={options}
            value={profile}
            onValueChange={(value) => {
              if ((PROFILE_IDS as string[]).includes(value) || isSavedProfileId(value)) api.apply(value as ProfileId | SavedProfileId);
            }}
          />
        </div>
        {menuItems.length > 0 && <KebabMenuButton items={[...menuItems]} ariaLabel={t("Profile actions")} />}
        {profile !== "custom" && (current ? modified : true) && (
          <DisabledReason reason={current ? undefined : t("Built-in profiles are fixed — use Save as…")}>
            <Button variant="outline" disabled={!current} data-slot="profile-save" onClick={() => api.save()}>
              {t("Save")}
            </Button>
          </DisabledReason>
        )}
        <Button variant="outline" onClick={() => setDialog("saveAs")}>
          {t("Save as…")}
        </Button>
        {modified && (
          <Button variant="outline" onClick={() => api.discard()}>
            {t("Discard changes")}
          </Button>
        )}
        <Button variant="outline" onClick={() => fileInput.current?.click()}>
          {t("Import…")}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label={t("Profile file")}
          data-slot="profile-import-input"
          onChange={onFile}
        />
      </div>
      <p className="lyra-body-sm text-lyra-fg-secondary">
        {t(
          "A profile sets the agent settings on this page; your theme, phone setup and Home tab order stay yours. Phase 1 is the defaults; Phase 2 adds the header apps (Customers, Accounts and Tickets as Home tabs; Schedule and WEM in the header) and every channel; AI-first is Phase 2 with every conversation in the side panel and the AI workspace in the main column. Save as keeps the current settings as your own profile; a saved profile can lock sections, export to a file and import on another workspace. Changing a setting shows the profile as modified: Save writes the changes back into a saved profile (locks kept) and Discard changes reverts them; built-in profiles are fixed, so use Save as. Custom is only for settings that match no profile.",
        )}
      </p>

      <ProfileNameDialog
        open={dialog === "saveAs"}
        title={t("Save as profile")}
        confirmLabel={t("Save")}
        initialName={currentName && profile !== "custom" ? t("Copy of {name}", { name: currentName }) : ""}
        onConfirm={(name) => {
          const added = api.saveAs(name);
          // Its values are the current ones, so it derives as picked —
          // unless a built-in has the same values (built-ins win a tie).
          return added !== null;
        }}
        onClose={() => setDialog(null)}
      />
      {current && (
        <>
          <ProfileNameDialog
            open={dialog === "rename"}
            title={t("Rename profile")}
            confirmLabel={t("Rename")}
            initialName={current.name}
            onConfirm={(name) => api.rename(current.id, name)}
            onClose={() => setDialog(null)}
          />
          <DeleteProfileDialog
            open={dialog === "delete"}
            name={current.name}
            onConfirm={() => api.remove(current.id)}
            onClose={() => setDialog(null)}
          />
          <ProfileLocksDialog
            open={dialog === "locks"}
            name={current.name}
            locks={current.locks}
            onSave={(locks) => api.setLocks(current.id, locks)}
            onClose={() => setDialog(null)}
          />
        </>
      )}
      <ImportResultDialog
        outcome={importOutcome}
        onApply={() => {
          if (importedId) api.apply(importedId);
        }}
        onClose={() => setImportOutcome(null)}
      />
    </>
  );
}
