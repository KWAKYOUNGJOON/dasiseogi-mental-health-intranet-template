import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import {
  downloadStatisticsExport,
  fetchStatisticsAlerts,
  fetchStatisticsMetadata,
  fetchStatisticsScales,
  fetchStatisticsSummary,
  type StatisticsAlertPage,
  type StatisticsMetadata,
  type StatisticsScaleResponse,
  type StatisticsSummary,
} from '../../features/statistics/api/statisticsApi'
import { DateTextInput } from '../../shared/components/DateTextInput'
import { PageHeader } from '../../shared/components/PageHeader'
import type { ApiResponse } from '../../shared/types/api'
import { hasAdminAccess } from '../../shared/user/userMetadata'
import { getDefaultStatisticsSeoulDateRange, toValidDateText } from '../../shared/utils/dateText'
import {
  DEFAULT_STATISTICS_ALERT_PAGE_SIZE,
  formatStatisticsAlertScaleLabel,
  formatStatisticsAlertTypeLabel,
  getStatisticsAlertTypeLabels,
  getStatisticsAlertTypeOptions,
  formatStatisticsScaleLabel,
  formatStatisticsScaleListLabel,
  formatStatisticsScaleOptionLabel,
} from './statisticsMetadata'

function getStatisticsErrorMessage(error: unknown, fallbackMessage: string) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return fallbackMessage
  }

  return error.response?.data?.message ?? fallbackMessage
}

export function StatisticsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const defaultDateRange = getDefaultStatisticsSeoulDateRange()
  const [dateFrom, setDateFrom] = useState(defaultDateRange.dateFrom)
  const [dateTo, setDateTo] = useState(defaultDateRange.dateTo)
  const [alertScaleCode, setAlertScaleCode] = useState('')
  const [alertType, setAlertType] = useState('')
  const [metadata, setMetadata] = useState<StatisticsMetadata | null>(null)
  const [summary, setSummary] = useState<StatisticsSummary | null>(null)
  const [scales, setScales] = useState<StatisticsScaleResponse | null>(null)
  const [alerts, setAlerts] = useState<StatisticsAlertPage | null>(null)
  const [alertPage, setAlertPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadAll(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAll(nextAlertPage = alertPage) {
    setLoading(true)
    try {
      const params = {
        dateFrom: toValidDateText(dateFrom) || undefined,
        dateTo: toValidDateText(dateTo) || undefined,
      }
      const [metadataData, summaryData, scaleData, alertData] = await Promise.all([
        fetchStatisticsMetadata(),
        fetchStatisticsSummary(params),
        fetchStatisticsScales(params),
        fetchStatisticsAlerts({
          ...params,
          scaleCode: alertScaleCode || undefined,
          alertType: alertType || undefined,
          page: nextAlertPage,
          size: DEFAULT_STATISTICS_ALERT_PAGE_SIZE,
        }),
      ])
      setMetadata(metadataData)
      setSummary(summaryData)
      setScales(scaleData)
      setAlerts(alertData)
      setAlertPage(nextAlertPage)
      setError(null)
    } catch (requestError: unknown) {
      setError(getStatisticsErrorMessage(requestError, '통계 정보를 불러오지 못했습니다.'))
    } finally {
      setLoading(false)
    }
  }

  const currentScaleItems = (scales?.items ?? []).filter((item) => item.isActive)
  const legacyScaleItems = (scales?.items ?? []).filter((item) => !item.isActive && item.totalCount > 0)
  const alertScaleOptions = [...currentScaleItems, ...legacyScaleItems]
  const alertTypeOptions = getStatisticsAlertTypeOptions(metadata?.alertTypes ?? [])
  const alertTypeLabels = getStatisticsAlertTypeLabels(metadata?.alertTypes ?? [])
  const exportDateFrom = toValidDateText(dateFrom) || undefined
  const exportDateTo = toValidDateText(dateTo) || undefined
  const selectedAlertScale = alertScaleOptions.find((item) => item.scaleCode === alertScaleCode)
  const selectedAlertScaleLabel = alertScaleCode ? formatStatisticsScaleLabel(selectedAlertScale ?? alertScaleCode) : '전체 척도'
  const canExportStatistics = hasAdminAccess(user)

  return (
    <div className="stack">
      <PageHeader
        actions={
          canExportStatistics ? (
            <div className="actions">
              <button
                className="secondary-button"
                onClick={() => void downloadStatisticsExport({ dateFrom: exportDateFrom, dateTo: exportDateTo, type: 'SUMMARY' })}
              >
                요약 CSV
              </button>
              <button
                className="secondary-button"
                onClick={() => void downloadStatisticsExport({ dateFrom: exportDateFrom, dateTo: exportDateTo, type: 'SCALE_COMPARE' })}
              >
                척도비교 CSV
              </button>
              <button
                className="secondary-button"
                onClick={() => void downloadStatisticsExport({ dateFrom: exportDateFrom, dateTo: exportDateTo, type: 'ALERT_LIST' })}
              >
                경고목록 CSV
              </button>
            </div>
          ) : null
        }
        description="오입력 세션은 기본 제외된 기준으로 집계합니다."
        title="통계"
      />
      <div className="card stack">
        <div className="toolbar">
          <DateTextInput aria-label="시작일" onChange={setDateFrom} placeholder="시작일 (연도. 월. 일.)" value={dateFrom} />
          <DateTextInput aria-label="종료일" onChange={setDateTo} placeholder="종료일 (연도. 월. 일.)" value={dateTo} />
          <select aria-label="경고 척도" onChange={(event) => setAlertScaleCode(event.target.value)} value={alertScaleCode}>
            <option value="">전체 척도</option>
            {alertScaleOptions.map((item) => (
              <option key={item.scaleCode} value={item.scaleCode}>
                {formatStatisticsScaleOptionLabel(item)}
              </option>
            ))}
          </select>
          <select aria-label="경고 유형" onChange={(event) => setAlertType(event.target.value)} value={alertType}>
            <option value="">전체 경고유형</option>
            {alertTypeOptions.map((option) => (
              <option key={option} value={option}>
                {formatStatisticsAlertTypeLabel(option, alertTypeLabels)}
              </option>
            ))}
          </select>
          <button className="secondary-button" onClick={() => void loadAll(1)}>
            조회
          </button>
        </div>
        {error ? <div className="error-text">{error}</div> : null}
        {loading ? <p>불러오는 중...</p> : null}
        {!loading && summary ? (
          <>
            <div className="summary-grid">
              <div className="stat-card">
                <span className="muted">전체 세션</span>
                <strong>{summary.totalSessionCount}</strong>
              </div>
              <div className="stat-card">
                <span className="muted">전체 척도 시행</span>
                <strong>{summary.totalScaleCount}</strong>
              </div>
              <div className="stat-card">
                <span className="muted">경고 세션</span>
                <strong>{summary.alertSessionCount}</strong>
              </div>
              <div className="stat-card">
                <span className="muted">경고 척도</span>
                <strong>{summary.alertScaleCount}</strong>
              </div>
            </div>

            <div className="card stack" style={{ padding: 16 }}>
              <div className="actions" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>담당자별 세션 수</h3>
                <span className="muted">
                  {summary.dateFrom} ~ {summary.dateTo}
                </span>
              </div>
              {summary.performedByStats.length === 0 ? (
                <p className="muted">집계된 세션이 없습니다.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>담당자</th>
                      <th>세션 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.performedByStats.map((item) => (
                      <tr key={item.userId}>
                        <td>{item.userName}</td>
                        <td>{item.sessionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card stack" style={{ padding: 16 }}>
              <h3 style={{ margin: 0 }}>현재 운영 척도</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>척도</th>
                    <th>시행 건수</th>
                    <th>경고 건수</th>
                  </tr>
                </thead>
                <tbody>
                  {currentScaleItems.map((item) => (
                    <tr key={item.scaleCode}>
                      <td>{formatStatisticsScaleListLabel(item)}</td>
                      <td>{item.totalCount}</td>
                      <td>{item.alertCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {legacyScaleItems.length > 0 ? (
                <div className="stack">
                  <h4 style={{ margin: 0 }}>과거 비활성 척도 기록</h4>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>척도</th>
                        <th>시행 건수</th>
                        <th>경고 건수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legacyScaleItems.map((item) => (
                        <tr key={item.scaleCode}>
                          <td>
                            {formatStatisticsScaleListLabel(item)} <span className="muted">(비활성)</span>
                          </td>
                          <td>{item.totalCount}</td>
                          <td>{item.alertCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            <div className="card stack" style={{ padding: 16 }}>
              <div className="actions" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>경고 기록</h3>
                <span className="muted">
                  필터: {selectedAlertScaleLabel} / {alertType ? formatStatisticsAlertTypeLabel(alertType, alertTypeLabels) : '전체 유형'}
                </span>
              </div>
              {alerts && alerts.items.length > 0 ? (
                <>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>검사일시</th>
                        <th>대상자</th>
                        <th>담당자</th>
                        <th>척도</th>
                        <th>유형</th>
                        <th>메시지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.items.map((alert, index) => (
                        <tr
                          className="clickable-row"
                          key={`${alert.sessionId}-${alert.scaleCode}-${index}`}
                          onClick={() => navigate(`/assessments/sessions/${alert.sessionId}?highlightScaleCode=${alert.scaleCode}`)}
                        >
                          <td>{alert.sessionCompletedAt}</td>
                          <td>{alert.clientName}</td>
                          <td>{alert.performedByName}</td>
                          <td>{formatStatisticsAlertScaleLabel(alert)}</td>
                          <td>{formatStatisticsAlertTypeLabel(alert.alertType, alertTypeLabels)}</td>
                          <td>{alert.alertMessage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="actions" style={{ justifyContent: 'space-between' }}>
                    <span className="muted">
                      {alerts.totalItems}건 / {alerts.page}페이지
                    </span>
                    <div className="actions">
                      <button className="secondary-button" disabled={alertPage <= 1} onClick={() => void loadAll(alertPage - 1)}>
                        이전
                      </button>
                      <button
                        className="secondary-button"
                        disabled={alerts.totalPages === 0 || alertPage >= alerts.totalPages}
                        onClick={() => void loadAll(alertPage + 1)}
                      >
                        다음
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="muted">경고 기록이 없습니다.</p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
