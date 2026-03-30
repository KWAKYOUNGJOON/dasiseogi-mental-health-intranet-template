import { isAxiosError } from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchScales, type ScaleListItem } from '../../features/assessment/api/assessmentApi'
import { ScaleSelectForm } from '../../features/assessment/components/ScaleSelectForm'
import { useAssessmentDraftStore } from '../../features/assessment/store/assessmentDraftStore'
import { PageHeader } from '../../shared/components/PageHeader'
import type { ApiResponse } from '../../shared/types/api'

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return fallbackMessage
  }

  return error.response?.data?.message ?? fallbackMessage
}

export function AssessmentScaleSelectPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const initialize = useAssessmentDraftStore((state) => state.initialize)
  const [items, setItems] = useState<ScaleListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const parsedClientId = Number(clientId)
  const hasValidClientId = Number.isInteger(parsedClientId) && parsedClientId > 0

  useEffect(() => {
    if (!hasValidClientId) {
      setLoading(false)
      return
    }

    async function loadScales() {
      setLoading(true)
      try {
        const data = await fetchScales()
        setItems(data)
        setError(null)
      } catch (requestError: unknown) {
        setError(getErrorMessage(requestError, '척도 목록을 불러오지 못했습니다.'))
      } finally {
        setLoading(false)
      }
    }

    void loadScales()
  }, [clientId, hasValidClientId])

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
    if (!hasValidClientId || selectedCodes.length === 0) return

    initialize(
      parsedClientId,
      sortedItems.filter((item) => selectedCodes.includes(item.scaleCode)).map((item) => item.scaleCode),
    )
    navigate(`/assessments/start/${clientId}/input`)
  }

  if (!hasValidClientId) {
    return <div className="error-text">대상자 정보를 확인할 수 없습니다.</div>
  }

  if (error) {
    return <div className="error-text">{error}</div>
  }

  return (
    <div className="stack">
      <PageHeader description="선택한 척도는 displayOrder 순서대로 다음 단계로 전달됩니다." title="척도 선택" />
      {loading ? (
        <div>척도 목록을 불러오는 중...</div>
      ) : (
        <ScaleSelectForm
          clientId={parsedClientId}
          items={sortedItems}
          onSubmit={handleStart}
          onToggle={toggle}
          selectedCodes={selectedCodes}
        />
      )}
    </div>
  )
}
