import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchScales, type ScaleListItem } from '../../features/assessment/api/assessmentApi'
import { ScaleSelectionList } from '../../features/assessment/components/ScaleSelectionList'
import { useAssessmentDraftStore } from '../../features/assessment/store/assessmentDraftStore'
import { PageHeader } from '../../shared/components/PageHeader'

export function AssessmentScaleSelectPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const initialize = useAssessmentDraftStore((state) => state.initialize)
  const [items, setItems] = useState<ScaleListItem[]>([])
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])

  useEffect(() => {
    void fetchScales().then(setItems)
  }, [])

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.displayOrder - right.displayOrder),
    [items],
  )

  function toggle(scaleCode: string) {
    setSelectedCodes((previous) =>
      previous.includes(scaleCode) ? previous.filter((code) => code !== scaleCode) : [...previous, scaleCode],
    )
  }

  function handleStart() {
    if (!clientId || selectedCodes.length === 0) return
    initialize(
      Number(clientId),
      sortedItems.filter((item) => selectedCodes.includes(item.scaleCode)).map((item) => item.scaleCode),
    )
    navigate(`/assessments/start/${clientId}/input`)
  }

  return (
    <div className="stack">
      <PageHeader description="선택한 척도를 displayOrder 순서대로 입력하고 한 세션으로 저장합니다." title="척도 선택" />
      <ScaleSelectionList items={sortedItems} onToggle={toggle} selectedCodes={selectedCodes} />
      <div className="actions">
        <button className="primary-button" disabled={selectedCodes.length === 0} onClick={handleStart}>
          검사 시작
        </button>
      </div>
    </div>
  )
}
