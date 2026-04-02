interface AssessmentProgressHeaderProps {
  currentScaleCode: string
  scaleCodes: string[]
}

export function AssessmentProgressHeader({
  currentScaleCode,
  scaleCodes,
}: AssessmentProgressHeaderProps) {
  const currentIndex = scaleCodes.findIndex((scaleCode) => scaleCode === currentScaleCode)

  return (
    <div className="card assessment-progress-header">
      <div className="assessment-progress-header__top">
        <div className="assessment-progress-header__heading">
          <strong>선택된 척도 순서</strong>
          <span className="muted">현재 입력 중인 척도 위치를 빠르게 확인합니다.</span>
        </div>
        <span className="assessment-progress-header__badge">
          {currentIndex + 1} / {scaleCodes.length}
        </span>
      </div>
      <div aria-label="선택된 척도 진행 순서" className="assessment-progress-header__steps" role="list">
        {scaleCodes.map((scaleCode, index) => {
          const isCurrent = scaleCode === currentScaleCode

          return (
            <span
              aria-current={isCurrent ? 'step' : undefined}
              className={`status-chip assessment-progress-chip${isCurrent ? ' is-current' : ''}`}
              key={scaleCode}
              role="listitem"
            >
              {index + 1}. {scaleCode}
            </span>
          )
        })}
      </div>
    </div>
  )
}
