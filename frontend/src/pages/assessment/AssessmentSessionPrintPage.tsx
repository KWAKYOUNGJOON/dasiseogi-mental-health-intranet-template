import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchSessionPrintData, type SessionPrintData } from '../../features/assessment/api/assessmentApi'
import { formatAssessmentLocalDateTimeText } from '../../shared/utils/dateText'

export function AssessmentSessionPrintPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<SessionPrintData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      return
    }
    void fetchSessionPrintData(Number(sessionId))
      .then(setData)
      .catch((requestError: any) => {
        setError(requestError?.response?.data?.message ?? '출력 데이터를 불러오지 못했습니다.')
      })
  }, [sessionId])

  if (error) {
    return <div className="stack" style={{ padding: 24 }}><div className="error-text">{error}</div></div>
  }

  if (!data) {
    return <div className="stack" style={{ padding: 24 }}>출력 데이터를 불러오는 중...</div>
  }

  return (
    <div className="stack" style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <div className="actions" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>{data.institutionName}</h1>
        <div className="actions">
          <button className="secondary-button" onClick={() => navigate(-1)}>
            닫기
          </button>
          <button className="primary-button" onClick={() => window.print()}>
            인쇄
          </button>
        </div>
      </div>

      <p style={{ margin: 0 }}>
        세션 상세의 출력용 화면입니다. 인쇄하려면 '인쇄'를 누르세요.
      </p>

      <div className="card grid-2">
        <div className="field">
          <span className="muted">팀명</span>
          <strong>{data.teamName ?? '-'}</strong>
        </div>
        <div className="field">
          <span className="muted">담당자</span>
          <strong>{data.performedByName}</strong>
        </div>
        <div className="field">
          <span className="muted">대상자</span>
          <strong>{data.client.name}</strong>
        </div>
        <div className="field">
          <span className="muted">대상자 번호</span>
          <strong>{data.client.clientNo}</strong>
        </div>
        <div className="field">
          <span className="muted">생년월일</span>
          <strong>{data.client.birthDate}</strong>
        </div>
        <div className="field">
          <span className="muted">성별</span>
          <strong>{data.client.gender}</strong>
        </div>
        <div className="field">
          <span className="muted">세션 번호</span>
          <strong>{data.sessionNo}</strong>
        </div>
        <div className="field">
          <span className="muted">검사 완료</span>
          <strong>{formatAssessmentLocalDateTimeText(data.sessionCompletedAt)}</strong>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>세션 요약</h2>
        <p style={{ margin: 0 }}>{data.summaryText}</p>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>척도 결과</h2>
        <table className="table">
          <thead>
            <tr>
              <th>척도</th>
              <th>총점</th>
              <th>판정</th>
              <th>경고</th>
            </tr>
          </thead>
          <tbody>
            {data.scales.map((scale) => (
              <tr key={scale.scaleCode}>
                <td>{scale.scaleName}</td>
                <td>{scale.totalScore}</td>
                <td>{scale.resultLevel}</td>
                <td>{scale.alertMessages.length > 0 ? scale.alertMessages.join(' / ') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
