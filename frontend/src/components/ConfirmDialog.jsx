import { Loader2 } from 'lucide-react'

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 animate-fade-in"
      onClick={busy ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div className="card bg-surface w-full max-w-sm shadow-brutal" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="text-sm text-muted mt-2 leading-relaxed">{message}</p>

        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} disabled={busy} className="btn-secondary flex-1">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="btn-secondary flex-1 !bg-red-600 !text-white"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
