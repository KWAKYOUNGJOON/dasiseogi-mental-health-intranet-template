import type { ScaleListItem } from '../api/assessmentApi'

function getScaleSelectionCardText(item: ScaleListItem) {
  return {
    title: item.selectionTitle?.trim() || item.scaleName,
    subtitle: item.selectionSubtitle?.trim() || '',
  }
}

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
      {items.map((item) => {
        const displayText = getScaleSelectionCardText(item)

        return (
          <label className="card" key={item.scaleCode} style={{ opacity: item.isActive ? 1 : 0.56 }}>
            <div className="actions" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{displayText.title}</strong>
                {displayText.subtitle ? <p className="muted">{displayText.subtitle}</p> : null}
              </div>
              <input
                checked={selectedCodes.includes(item.scaleCode)}
                disabled={!item.isActive || !item.implemented}
                onChange={() => onToggle(item.scaleCode)}
                type="checkbox"
              />
            </div>
          </label>
        )
      })}
    </div>
  )
}
