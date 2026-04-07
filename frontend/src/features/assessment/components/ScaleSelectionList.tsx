import type { ScaleListItem } from '../api/assessmentApi'

const SCALE_SELECTION_CARD_TEXT_BY_CODE: Record<string, { title: string; subtitle: string }> = {
  PHQ9: { title: 'PHQ-9', subtitle: '우울' },
  GAD7: { title: 'GAD-7', subtitle: '불안' },
  MKPQ16: { title: 'mKPQ-16', subtitle: '정신증 위험' },
  KMDQ: { title: 'K-MDQ', subtitle: '양극성(조울증)' },
  PSS10: { title: 'PSS-10', subtitle: '스트레스' },
  ISIK: { title: 'ISI-K', subtitle: '불면' },
  AUDITK: { title: 'AUDIT-K', subtitle: '알코올 사용' },
  IESR: { title: 'IES-R', subtitle: '외상 후 스트레스(PTSD)' },
  CRI: { title: 'CRI', subtitle: '정신과적 위기 분류 평정척도' },
}

function getScaleSelectionCardText(item: ScaleListItem) {
  return SCALE_SELECTION_CARD_TEXT_BY_CODE[item.scaleCode] ?? { title: item.scaleName, subtitle: '' }
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
