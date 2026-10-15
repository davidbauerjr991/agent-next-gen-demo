import { Button, Modal, WarningIcon } from "@nicecxone/lyra-ui";

/** "Close this contact?" (Settings → Assignments → Confirm before closing).
 *  lyra `Modal` as an alert dialog, the same shape as Settings' Reset
 *  dialog: focus starts on Cancel. */
export function ConfirmCloseDialog({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      closeOnBackdropClick
      alert
      description="The contact is unassigned and removed from your list."
      headerTitle="Close this contact?"
      headerIcon={<WarningIcon className="h-5 w-5" />}
      footerActions={
        <>
          <Button variant="outline" data-modal-cancel onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Close contact
          </Button>
        </>
      }
      className="w-[360px]"
    >
      <div className="flex flex-col gap-2 px-5 pb-2">
        <p className="lyra-body-md text-lyra-fg-default">The contact is unassigned and removed from your list.</p>
      </div>
    </Modal>
  );
}
