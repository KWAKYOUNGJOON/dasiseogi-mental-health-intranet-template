import type { ScaleDetail } from '../api/assessmentApi'

export function ScaleQuestionForm({
  scale,
  answers,
  onSelect,
}: {
  scale: ScaleDetail
  answers: Record<number, string>
  onSelect: (questionNo: number, value: string) => void
}) {
  return (
    <div className="assessment-question-list">
      {scale.questions.map((question) => {
        const selectedValue = answers[question.questionNo]

        return (
          <fieldset className="assessment-question-card" key={question.questionNo}>
            <legend className="assessment-question-legend">
              <span className="assessment-question-number">문항 {question.questionNo}</span>
              <span className="assessment-question-title">{question.questionText}</span>
            </legend>
            <div className="assessment-option-grid">
              {question.options.map((option) => {
                const isSelected = selectedValue === option.value

                return (
                  <label className={`assessment-option${isSelected ? ' is-selected' : ''}`} key={option.value}>
                    <input
                      checked={isSelected}
                      className="visually-hidden"
                      name={`${scale.scaleCode}-${question.questionNo}`}
                      onChange={() => onSelect(question.questionNo, option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <span aria-hidden="true" className="assessment-option-indicator" />
                    <span className="assessment-option-label">{option.label}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
