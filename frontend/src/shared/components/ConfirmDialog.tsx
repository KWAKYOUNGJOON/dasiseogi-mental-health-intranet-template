import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'secondary' | 'danger'
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
  confirmVariant = 'danger',
  confirmDisabled = false,
  processing = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) {
    return null
  }

  const confirmButtonClassName =
    confirmVariant === 'primary'
      ? 'primary-button'
      : confirmVariant === 'secondary'
        ? 'secondary-button'
        : 'danger-button'

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
          <button className={confirmButtonClassName} disabled={confirmDisabled || processing} onClick={onConfirm}>
            {processing ? '처리 중...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
