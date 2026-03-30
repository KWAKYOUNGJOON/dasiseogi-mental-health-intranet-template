import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  confirmDisabled?: boolean
  processing?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '확인',
  cancelText = '취소',
  confirmDisabled = false,
  processing = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) {
    return null
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="dialog-card stack">
        <div className="stack">
          <h3 style={{ margin: 0 }}>{title}</h3>
          {description ? <p className="muted" style={{ margin: 0 }}>{description}</p> : null}
        </div>
        {children}
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button className="secondary-button" disabled={processing} onClick={onCancel}>
            {cancelText}
          </button>
          <button className="danger-button" disabled={confirmDisabled || processing} onClick={onConfirm}>
            {processing ? '처리 중...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
