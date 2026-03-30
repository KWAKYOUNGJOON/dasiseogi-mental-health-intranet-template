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
    <div className="card stack">
      <div className="actions" style={{ justifyContent: 'space-between' }}>
        <strong>진행 상태</strong>
        <span className="muted">
          {currentIndex + 1} / {scaleCodes.length}
        </span>
      </div>
      <div className="actions">
        {scaleCodes.map((scaleCode, index) => {
          const isCurrent = scaleCode === currentScaleCode

          return (
            <span
              aria-current={isCurrent ? 'step' : undefined}
              className="status-chip"
              key={scaleCode}
              style={
                isCurrent
                  ? {
                      background: '#1d6a7d',
                      color: '#fff',
                    }
                  : undefined
              }
            >
              {index + 1}. {scaleCode}
            </span>
          )
        })}
      </div>
    </div>
  )
}
