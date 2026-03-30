import type { ScaleListItem } from '../api/assessmentApi'
import { ScaleSelectionList } from './ScaleSelectionList'

interface ScaleSelectFormProps {
  clientId: number
  items: ScaleListItem[]
  selectedCodes: string[]
  onToggle: (scaleCode: string) => void
  onSubmit: () => void
}

export function ScaleSelectForm({
  clientId,
  items,
  selectedCodes,
  onToggle,
  onSubmit,
}: ScaleSelectFormProps) {
  return (
    <div className="stack">
      <div className="card">
        <p className="muted">대상자 ID {clientId}에 대해 시작할 척도를 선택하세요. 선택한 척도는 displayOrder 순서대로 다음 단계로 전달됩니다.</p>
      </div>
      {items.length > 0 ? (
        <ScaleSelectionList items={items} onToggle={onToggle} selectedCodes={selectedCodes} />
      ) : (
        <div className="card">
          <p className="muted">선택 가능한 척도가 없습니다.</p>
        </div>
      )}
      <div className="actions">
        <button className="primary-button" disabled={selectedCodes.length === 0} onClick={onSubmit}>
          검사 시작
        </button>
      </div>
    </div>
  )
}
