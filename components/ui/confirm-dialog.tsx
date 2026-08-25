import { Sheet } from "./sheet";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
}

// ConfirmDialog | confirm is never the default focus. Cancel is first in DOM
// order and the close (X) icon is hidden, so the dialog's native initial
// focus lands on Cancel — an explicit choice is required either way.
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
}: ConfirmDialogProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title} hideCloseButton>
      <p className="text-body font-ui text-ink">{body}</p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
