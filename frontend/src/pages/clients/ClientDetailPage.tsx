import { isAxiosError } from 'axios'
import { useEffect, useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchScales, type ScaleListItem } from '../../features/assessment/api/assessmentApi'
import {
  fetchClientDetail,
  fetchClientScaleTrend,
  markClientMisregistered,
  type ClientDetail,
  type ClientScaleTrend,
} from '../../features/clients/api/clientApi'
import { useAuth } from '../../app/providers/AuthProvider'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog'
import { PageHeader } from '../../shared/components/PageHeader'
import { getClientStatusLabel } from '../../shared/display/entityDisplayMetadata'
import { formatScaleSelectionLabel } from '../../shared/scales/scaleDisplay'
import type { ApiResponse } from '../../shared/types/api'
import { hasAdminAccess } from '../../shared/user/userMetadata'

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return fallbackMessage
  }

  return error.response?.data?.message ?? fallbackMessage
}

function getOperatingScaleItems(items: ScaleListItem[]) {
  return items
    .filter((item) => item.isActive && item.implemented)
    .sort((left, right) => left.displayOrder - right.displayOrder)
}

function getScaleOptionLabel(item: ScaleListItem) {
  return formatScaleSelectionLabel(item, {
    criMode: 'titleWithSubtitle',
    fallbackWithCode: true,
  })
}

function getDefaultSelectedScaleCode(
  items: ScaleListItem[],
  latestRecordedScaleCode: string | null | undefined,
) {
  const normalizedLatestRecordedScaleCode = latestRecordedScaleCode?.trim() ?? ''

  if (normalizedLatestRecordedScaleCode) {
    const matchedScale = items.find((item) => item.scaleCode === normalizedLatestRecordedScaleCode)

    if (matchedScale) {
      return matchedScale.scaleCode
    }
  }

  return items[0]?.scaleCode ?? ''
}

function getLatestTrendPoint(points: ClientScaleTrend['points']) {
  return points[points.length - 1] ?? null
}

type TrendPoint = ClientScaleTrend['points'][number]
type TrendAlert = TrendPoint['alerts'][number]
type TrendChartPoint = {
  point: TrendPoint
  x: number
  y: number
}

const TREND_CHART_WIDTH = 720
const TREND_CHART_HEIGHT = 320
const TREND_CHART_MARGIN = {
  top: 20,
  right: 24,
  bottom: 52,
  left: 56,
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function formatTrendDateText(value: string) {
  return value.trim().slice(0, 10)
}

function formatTrendDateTimeText(value: string) {
  return value.trim().slice(0, 16)
}

function formatTrendAlertText(alert: TrendAlert) {
  return `${alert.alertType} / ${alert.alertMessage}`
}

function getTrendCutoffLabel(cutoff: ClientScaleTrend['cutoffs'][number]) {
  return `${cutoff.score} ${cutoff.label}`
}

function getTrendAxisLabelIndexes(pointCount: number) {
  if (pointCount <= 5) {
    return Array.from({ length: pointCount }, (_, index) => index)
  }

  const indexes = new Set<number>()

  for (let step = 0; step < 5; step += 1) {
    indexes.add(Math.round((step / 4) * (pointCount - 1)))
  }

  return [...indexes]
}

function buildTrendLinePath(points: TrendChartPoint[]) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
}

function getTrendPointAriaLabel(point: TrendPoint) {
  return `${formatTrendDateTimeText(point.assessedAt)} 총점 ${point.totalScore} 판정 ${point.resultLevel}`
}

function buildTrendSessionDetailPath(sessionId: number, selectedScaleCode: string) {
  const highlightScaleCode = selectedScaleCode.trim()

  if (!highlightScaleCode) {
    return `/assessments/sessions/${sessionId}`
  }

  const params = new URLSearchParams()
  params.set('highlightScaleCode', highlightScaleCode)

  return `/assessments/sessions/${sessionId}?${params.toString()}`
}

function ScaleTrendChart({
  trend,
  onPointSelect,
}: {
  trend: ClientScaleTrend
  onPointSelect: (point: TrendPoint) => void
}) {
  const descriptionId = useId()
  const tooltipId = useId()
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null)
  const chartInnerWidth = TREND_CHART_WIDTH - TREND_CHART_MARGIN.left - TREND_CHART_MARGIN.right
  const chartInnerHeight = TREND_CHART_HEIGHT - TREND_CHART_MARGIN.top - TREND_CHART_MARGIN.bottom
  const safeMaxScore = Math.max(trend.maxScore, 1)
  const chartPoints: TrendChartPoint[] = trend.points.map((point, index) => {
    const x =
      trend.points.length === 1
        ? TREND_CHART_MARGIN.left + chartInnerWidth / 2
        : TREND_CHART_MARGIN.left + (index / (trend.points.length - 1)) * chartInnerWidth
    const y =
      TREND_CHART_MARGIN.top +
      (1 - clampNumber(point.totalScore, 0, safeMaxScore) / safeMaxScore) * chartInnerHeight

    return {
      point,
      x,
      y,
    }
  })
  const axisLabelIndexes = getTrendAxisLabelIndexes(chartPoints.length)
  const activePoint = activePointIndex == null ? null : chartPoints[activePointIndex] ?? null
  const latestPoint = getLatestTrendPoint(trend.points)
  const tooltipLeft = activePoint == null ? 0 : clampNumber(activePoint.x, 132, TREND_CHART_WIDTH - 132)
  const tooltipStyle =
    activePoint == null
      ? undefined
      : activePoint.y < 100
        ? {
            left: `${(tooltipLeft / TREND_CHART_WIDTH) * 100}%`,
            top: `${((activePoint.y + 22) / TREND_CHART_HEIGHT) * 100}%`,
            transform: 'translate(-50%, 0)',
          }
        : {
            left: `${(tooltipLeft / TREND_CHART_WIDTH) * 100}%`,
            top: `${(activePoint.y / TREND_CHART_HEIGHT) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 14px))',
          }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <p className="muted" id={descriptionId} style={{ margin: 0 }}>
        점 위에 마우스를 올리거나 탭으로 선택하면 검사일시, 총점, 판정, 경고를 확인할 수 있습니다.
      </p>
      <div
        aria-describedby={descriptionId}
        aria-label={`${trend.scaleName} 척도 추세 차트`}
        data-testid="client-scale-trend-chart"
        role="group"
        style={{
          border: '1px solid #e2eaf1',
          borderRadius: 16,
          background: '#fbfdff',
          padding: 12,
        }}
      >
        <div style={{ minWidth: 0, position: 'relative', width: '100%', height: 320 }}>
          <svg
            aria-hidden="true"
            preserveAspectRatio="none"
            style={{ display: 'block', width: '100%', height: '100%' }}
            viewBox={`0 0 ${TREND_CHART_WIDTH} ${TREND_CHART_HEIGHT}`}
          >
            <line
              stroke="#d8e1ea"
              strokeWidth="1"
              x1={TREND_CHART_MARGIN.left}
              x2={TREND_CHART_MARGIN.left}
              y1={TREND_CHART_MARGIN.top}
              y2={TREND_CHART_HEIGHT - TREND_CHART_MARGIN.bottom}
            />
            <line
              stroke="#d8e1ea"
              strokeWidth="1"
              x1={TREND_CHART_MARGIN.left}
              x2={TREND_CHART_WIDTH - TREND_CHART_MARGIN.right}
              y1={TREND_CHART_HEIGHT - TREND_CHART_MARGIN.bottom}
              y2={TREND_CHART_HEIGHT - TREND_CHART_MARGIN.bottom}
            />
            <text
              fill="#5f7487"
              fontSize="12"
              textAnchor="end"
              x={TREND_CHART_MARGIN.left - 8}
              y={TREND_CHART_MARGIN.top + 4}
            >
              {trend.maxScore}
            </text>
            <text
              fill="#5f7487"
              fontSize="12"
              textAnchor="end"
              x={TREND_CHART_MARGIN.left - 8}
              y={TREND_CHART_HEIGHT - TREND_CHART_MARGIN.bottom + 4}
            >
              0
            </text>
            {trend.cutoffs.map((cutoff) => {
              const cutoffScore = clampNumber(cutoff.score, 0, safeMaxScore)
              const y =
                TREND_CHART_MARGIN.top + (1 - cutoffScore / safeMaxScore) * chartInnerHeight

              return (
                <g key={`${cutoff.score}-${cutoff.label}`}>
                  <line
                    stroke="#b7c9d8"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                    x1={TREND_CHART_MARGIN.left}
                    x2={TREND_CHART_WIDTH - TREND_CHART_MARGIN.right}
                    y1={y}
                    y2={y}
                  />
                  <text
                    fill="#496478"
                    fontSize="12"
                    textAnchor="end"
                    x={TREND_CHART_WIDTH - TREND_CHART_MARGIN.right}
                    y={y - 6}
                  >
                    {getTrendCutoffLabel(cutoff)}
                  </text>
                </g>
              )
            })}
            {chartPoints.length >= 2 ? (
              <path
                d={buildTrendLinePath(chartPoints)}
                data-testid="client-scale-trend-line"
                fill="none"
                stroke="#1d6a7d"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {chartPoints.map((point) => (
              <line
                key={`tick-${point.point.sessionScaleId}`}
                stroke="#d8e1ea"
                strokeWidth="1"
                x1={point.x}
                x2={point.x}
                y1={TREND_CHART_HEIGHT - TREND_CHART_MARGIN.bottom}
                y2={TREND_CHART_HEIGHT - TREND_CHART_MARGIN.bottom + 6}
              />
            ))}
            {chartPoints.map((point, index) =>
              axisLabelIndexes.includes(index) ? (
                <text
                  fill="#5f7487"
                  fontSize="11"
                  key={`label-${point.point.sessionScaleId}`}
                  textAnchor="middle"
                  x={point.x}
                  y={TREND_CHART_HEIGHT - TREND_CHART_MARGIN.bottom + 22}
                >
                  {formatTrendDateText(point.point.assessedAt)}
                </text>
              ) : null,
            )}
          </svg>
          {chartPoints.map((point, index) => {
            const isActive = activePointIndex === index

            return (
              <button
                aria-describedby={isActive ? tooltipId : undefined}
                aria-label={getTrendPointAriaLabel(point.point)}
                data-testid="client-scale-trend-point"
                key={point.point.sessionScaleId}
                onBlur={() => {
                  setActivePointIndex((current) => (current === index ? null : current))
                }}
                onClick={() => {
                  onPointSelect(point.point)
                }}
                onFocus={() => {
                  setActivePointIndex(index)
                }}
                onKeyDown={(event) => {
                  if (![' ', 'Space', 'Spacebar'].includes(event.key)) {
                    return
                  }

                  event.preventDefault()
                  onPointSelect(point.point)
                }}
                onMouseEnter={() => {
                  setActivePointIndex(index)
                }}
                onMouseLeave={() => {
                  setActivePointIndex((current) => (current === index ? null : current))
                }}
                style={{
                  appearance: 'none',
                  position: 'absolute',
                  left: `${(point.x / TREND_CHART_WIDTH) * 100}%`,
                  top: `${(point.y / TREND_CHART_HEIGHT) * 100}%`,
                  width: 16,
                  height: 16,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  border: '2px solid #ffffff',
                  background: isActive ? '#134f5e' : '#1d6a7d',
                  boxShadow: isActive ? '0 0 0 3px rgba(29, 106, 125, 0.2)' : '0 0 0 1px rgba(29, 106, 125, 0.12)',
                  cursor: 'pointer',
                  padding: 0,
                }}
                type="button"
              >
                <span className="visually-hidden">{getTrendPointAriaLabel(point.point)}</span>
              </button>
            )
          })}
          {activePoint && tooltipStyle ? (
            <div
              id={tooltipId}
              role="tooltip"
              style={{
                ...tooltipStyle,
                position: 'absolute',
                width: 240,
                maxWidth: 'calc(100% - 16px)',
                borderRadius: 12,
                background: '#163442',
                color: '#ffffff',
                padding: 12,
                boxShadow: '0 14px 28px rgba(16, 35, 59, 0.2)',
                zIndex: 1,
                pointerEvents: 'none',
              }}
            >
              <div style={{ display: 'grid', gap: 8 }}>
                <div className="field" style={{ gap: 4 }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.72)', fontSize: 12 }}>검사일시</span>
                  <strong>{formatTrendDateTimeText(activePoint.point.assessedAt)}</strong>
                </div>
                <div className="field" style={{ gap: 4 }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.72)', fontSize: 12 }}>총점</span>
                  <strong>{activePoint.point.totalScore}</strong>
                </div>
                <div className="field" style={{ gap: 4 }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.72)', fontSize: 12 }}>판정</span>
                  <strong>{activePoint.point.resultLevel}</strong>
                </div>
                <div className="field" style={{ gap: 4 }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.72)', fontSize: 12 }}>경고</span>
                  {activePoint.point.alerts.length === 0 ? (
                    <strong>경고 없음</strong>
                  ) : (
                    <div style={{ display: 'grid', gap: 4 }}>
                      {activePoint.point.alerts.map((alert) => (
                        <span key={alert.id}>{formatTrendAlertText(alert)}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {latestPoint ? (
        <p className="muted" style={{ margin: 0 }}>
          총 {trend.points.length}건 · 최대 {trend.maxScore}점 · 최근 검사 {formatTrendDateTimeText(latestPoint.assessedAt)} · 최근 판정{' '}
          {latestPoint.resultLevel}
        </p>
      ) : null}
    </div>
  )
}

export function ClientDetailPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [scaleItems, setScaleItems] = useState<ScaleListItem[]>([])
  const [scaleLoading, setScaleLoading] = useState(true)
  const [scaleError, setScaleError] = useState<string | null>(null)
  const [selectedScaleCode, setSelectedScaleCode] = useState('')
  const [hasUserSelectedScale, setHasUserSelectedScale] = useState(false)
  const [trend, setTrend] = useState<ClientScaleTrend | null>(null)
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)
  const parsedClientId = Number(clientId)
  const hasValidClientId = Number.isInteger(parsedClientId) && parsedClientId > 0

  useEffect(() => {
    if (!clientId) return
    void loadClient(Number(clientId))
  }, [clientId])

  useEffect(() => {
    if (!hasValidClientId) {
      setScaleItems([])
      setScaleLoading(false)
      setScaleError(null)
      setSelectedScaleCode('')
      return
    }

    let cancelled = false

    async function loadScaleOptions() {
      setScaleLoading(true)

      try {
        const data = await fetchScales()

        if (cancelled) {
          return
        }

        const operatingScaleItems = getOperatingScaleItems(data)

        setScaleItems(operatingScaleItems)
        setScaleError(null)
      } catch (requestError: unknown) {
        if (cancelled) {
          return
        }

        setScaleItems([])
        setScaleError(getErrorMessage(requestError, '척도 목록을 불러오지 못했습니다.'))
        setSelectedScaleCode('')
      } finally {
        if (!cancelled) {
          setScaleLoading(false)
        }
      }
    }

    void loadScaleOptions()

    return () => {
      cancelled = true
    }
  }, [hasValidClientId, parsedClientId])

  useEffect(() => {
    setSelectedScaleCode('')
    setHasUserSelectedScale(false)
  }, [parsedClientId])

  useEffect(() => {
    if (!hasValidClientId || scaleLoading || !client || client.id !== parsedClientId) {
      return
    }

    const latestRecordedScaleCode = client.latestRecordedScaleCode?.trim() ?? ''

    setSelectedScaleCode((current) => {
      const hasCurrentScale = scaleItems.some((item) => item.scaleCode === current)

      if (hasUserSelectedScale && hasCurrentScale) {
        return current
      }

      if (latestRecordedScaleCode) {
        const matchedScale = scaleItems.find((item) => item.scaleCode === latestRecordedScaleCode)

        if (matchedScale) {
          return matchedScale.scaleCode
        }
      }

      if (hasCurrentScale) {
        return current
      }

      return getDefaultSelectedScaleCode(scaleItems, latestRecordedScaleCode)
    })
  }, [client, hasUserSelectedScale, hasValidClientId, parsedClientId, scaleItems, scaleLoading])

  useEffect(() => {
    if (!hasValidClientId || !selectedScaleCode) {
      setTrend(null)
      setTrendError(null)
      setTrendLoading(false)
      return
    }

    let cancelled = false

    async function loadTrend() {
      setTrendLoading(true)
      setTrend(null)
      setTrendError(null)

      try {
        const data = await fetchClientScaleTrend(parsedClientId, selectedScaleCode)

        if (cancelled) {
          return
        }

        setTrend(data)
      } catch (requestError: unknown) {
        if (cancelled) {
          return
        }

        setTrend(null)
        setTrendError(getErrorMessage(requestError, '척도 추세를 불러오지 못했습니다.'))
      } finally {
        if (!cancelled) {
          setTrendLoading(false)
        }
      }
    }

    void loadTrend()

    return () => {
      cancelled = true
    }
  }, [hasValidClientId, parsedClientId, selectedScaleCode])

  async function loadClient(id: number) {
    try {
      const data = await fetchClientDetail(id)
      setClient(data)
      setError(null)
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, '대상자 정보를 불러오지 못했습니다.'))
    }
  }

  async function handleMarkMisregistered() {
    if (!client) return

    setProcessing(true)
    try {
      await markClientMisregistered(client.id, reason)
      await loadClient(client.id)
      setNotice('오등록 처리되었습니다.')
      setDialogOpen(false)
      setReason('')
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, '오등록 처리에 실패했습니다.'))
    } finally {
      setProcessing(false)
    }
  }

  if (error) {
    return <div className="error-text">{error}</div>
  }

  if (!client) {
    return <div>대상자 정보를 불러오는 중...</div>
  }

  const hasAdminPrivileges = hasAdminAccess(user)
  const canMarkMisregistered = hasAdminPrivileges || user?.id === client.createdById
  const canEditClient = hasAdminPrivileges || user?.id === client.createdById
  const selectedScale = scaleItems.find((item) => item.scaleCode === selectedScaleCode) ?? null

  function handleTrendPointSelect(point: TrendPoint) {
    navigate(buildTrendSessionDetailPath(point.sessionId, selectedScaleCode))
  }

  function renderScaleTrendContent() {
    if (scaleLoading) {
      return (
        <div aria-busy="true" className="muted">
          척도 목록을 불러오는 중...
        </div>
      )
    }

    if (scaleError) {
      return (
        <div className="error-text" role="alert">
          {scaleError}
        </div>
      )
    }

    if (scaleItems.length === 0) {
      return (
        <p className="muted" style={{ margin: 0 }}>
          표시할 운영 중 척도가 없습니다.
        </p>
      )
    }

    if (trendLoading) {
      return (
        <div aria-busy="true" className="muted">
          척도 추세를 불러오는 중...
        </div>
      )
    }

    if (trendError) {
      return (
        <div className="error-text" role="alert">
          {trendError}
        </div>
      )
    }

    if (!trend || trend.points.length === 0) {
      return (
        <p className="muted" style={{ margin: 0 }}>
          기록 없음
        </p>
      )
    }

    return (
      <div className="stack">
        <ScaleTrendChart key={trend.scaleCode} onPointSelect={handleTrendPointSelect} trend={trend} />
      </div>
    )
  }

  return (
    <div className="stack">
      <PageHeader
        actions={
          <div className="actions">
            {client.status === 'ACTIVE' ? (
              <Link className="primary-button" to={`/assessments/start/${client.id}`}>
                검사 시작
              </Link>
            ) : null}
            <Link className="secondary-button" to={`/assessment-records?clientName=${encodeURIComponent(client.name)}`}>
              전체 기록 보기
            </Link>
            {canEditClient ? (
              <Link className="secondary-button" to={`/clients/${client.id}/edit`}>
                정보 수정
              </Link>
            ) : null}
            {canMarkMisregistered && client.status !== 'MISREGISTERED' ? (
              <button className="danger-button" disabled={processing} onClick={() => {
                setError(null)
                setNotice(null)
                setDialogOpen(true)
              }}>
                오등록 처리
              </button>
            ) : null}
          </div>
        }
        description="연락처는 상세 화면에서만 노출됩니다."
        title={`${client.name} 상세`}
      />
      {notice ? <div className="success-text">{notice}</div> : null}
      <div className="card grid-2">
        <div className="field">
          <span className="muted">사례번호</span>
          <strong>{client.clientNo}</strong>
        </div>
        <div className="field">
          <span className="muted">담당자</span>
          <strong>{client.primaryWorkerName}</strong>
        </div>
        <div className="field">
          <span className="muted">생년월일</span>
          <strong>{client.birthDate}</strong>
        </div>
        <div className="field">
          <span className="muted">연락처</span>
          <strong>{client.phone ?? '-'}</strong>
        </div>
        <div className="field">
          <span className="muted">상태</span>
          <strong>{getClientStatusLabel(client.status)}</strong>
        </div>
      </div>
      {client.status === 'MISREGISTERED' ? (
        <div className="card stack">
          <div className="field">
            <span className="muted">오등록 처리 시각</span>
            <strong>{client.misregisteredAt ?? '-'}</strong>
          </div>
          <div className="field">
            <span className="muted">처리자</span>
            <strong>{client.misregisteredByName ?? '-'}</strong>
          </div>
          <div className="field">
            <span className="muted">사유</span>
            <strong>{client.misregisteredReason ?? '-'}</strong>
          </div>
        </div>
      ) : null}
      <div className="card stack">
        <h3 style={{ margin: 0 }}>최근 검사 세션</h3>
        {client.recentSessions.length === 0 ? (
          <p className="muted">아직 저장된 검사 세션이 없습니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>세션번호</th>
                <th>검사일시</th>
                <th>담당자</th>
                <th>척도 수</th>
                <th>경고</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {client.recentSessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.sessionNo}</td>
                  <td>{session.sessionCompletedAt}</td>
                  <td>{session.performedByName}</td>
                  <td>{session.scaleCount}</td>
                  <td>{session.hasAlert ? '있음' : '없음'}</td>
                  <td>
                    <Link className="secondary-button" to={`/assessments/sessions/${session.id}`}>
                      세션 상세
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <section aria-labelledby="client-scale-trend-heading" className="card stack">
        <div
          className="actions"
          style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}
        >
          <h3 id="client-scale-trend-heading" style={{ margin: 0 }}>
            척도 추세
          </h3>
          <label className="field" htmlFor="client-scale-trend-select" style={{ marginBottom: 0, minWidth: 240 }}>
            <span className="muted">척도 선택</span>
            <select
              disabled={scaleLoading || scaleItems.length === 0}
              id="client-scale-trend-select"
              onChange={(event) => {
                setSelectedScaleCode(event.target.value)
                setHasUserSelectedScale(true)
              }}
              value={selectedScaleCode}
            >
              {scaleItems.map((item) => (
                <option key={item.scaleCode} value={item.scaleCode}>
                  {getScaleOptionLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedScale ? (
          <span className="muted">현재 선택: {getScaleOptionLabel(selectedScale)}</span>
        ) : null}
        {renderScaleTrendContent()}
      </section>
      <ConfirmDialog
        confirmDisabled={!reason.trim()}
        confirmText="오등록 처리"
        description="물리 삭제하지 않고 대상자 상태만 MISREGISTERED로 변경합니다."
        onCancel={() => {
          if (processing) return
          setDialogOpen(false)
          setReason('')
        }}
        onConfirm={() => void handleMarkMisregistered()}
        open={dialogOpen}
        processing={processing}
        title="대상자 오등록 처리"
      >
        <div className="field">
          <span className="muted">사유</span>
          <textarea onChange={(event) => setReason(event.target.value)} rows={4} value={reason} />
        </div>
      </ConfirmDialog>
    </div>
  )
}
