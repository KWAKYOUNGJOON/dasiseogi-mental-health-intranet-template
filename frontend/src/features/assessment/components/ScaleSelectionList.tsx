import type { ScaleListItem } from '../api/assessmentApi'

export function ScaleSelectionList({
  items,
  selectedCodes,
  onToggle,
}: {
  items: ScaleListItem[]
  selectedCodes: string[]
  onToggle: (scaleCode: string) => void
}) {
  return (
    <div className="stack">
      {items.map((item) => (
        <label className="card" key={item.scaleCode} style={{ opacity: item.isActive ? 1 : 0.56 }}>
          <div className="actions" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{item.scaleName}</strong>
              <p className="muted">{item.isActive ? '현재 사용 가능' : '이번 단계에서는 준비 중'}</p>
            </div>
            <input
              checked={selectedCodes.includes(item.scaleCode)}
              disabled={!item.isActive || !item.implemented}
              onChange={() => onToggle(item.scaleCode)}
              type="checkbox"
            />
          </div>
        </label>
      ))}
    </div>
  )
}
