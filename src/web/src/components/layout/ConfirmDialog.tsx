import { ModalPortal } from "./ModalPortal";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[1100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="win-modal w-full max-w-sm">
        <div className="win-titlebar">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          <button className="win-button" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-3">
          <p className="text-[12.5px] leading-relaxed text-secondary">{message}</p>
        </div>
        <div className="flex justify-end gap-1 border-t divider p-3">
          <button className="win-button" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`win-button ${danger ? "" : "win-button-primary"}`}
            style={danger ? { background: "var(--danger)", borderColor: "var(--danger)", color: "#1a0b0b" } : undefined}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Menghapus…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
