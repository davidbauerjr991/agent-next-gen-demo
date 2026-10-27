import { Button, Modal, WarningIcon } from "@nicecxone/lyra-ui";

/** "Close this contact?" (Settings → Assignments → Confirm before closing).
 *  lyra `Modal` as an alert dialog, the same shape as Settings' Reset
 *  dialog: focus starts on Cancel. */
/** What the confirm says: a contact's close by default; a kind card's Return to feed passes its own (P-HOME-1h). */
export interface ConfirmCloseCopy {
  title: string;
  description: string;
  confirmLabel: string;
}

const CONTACT_CLOSE: ConfirmCloseCopy = {
  title: "Close this contact?",
  description: "The contact is unassigned and removed from your list.",
  confirmLabel: "Close contact",
};

export function ConfirmCloseDialog({
  open,
  onConfirm,
  onCancel,
  copy = CONTACT_CLOSE,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  copy?: ConfirmCloseCopy;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      closeOnBackdropClick
      alert
      description={copy.description}
      headerTitle={copy.title}
      headerIcon={<WarningIcon className="h-5 w-5" />}
      footerActions={
        <>
          <Button variant="outline" data-modal-cancel onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {copy.confirmLabel}
          </Button>
        </>
      }
      className="w-[360px]"
    >
      <div className="flex flex-col gap-2 px-5 pb-2">
        <p className="lyra-body-md text-lyra-fg-default">{copy.description}</p>
      </div>
    </Modal>
  );
}
