import type { ScaleDetail } from '../api/assessmentApi'
import { getRenderableQuestions } from '../utils/kmdq'

export function ScaleQuestionForm({
  scale,
  answers,
  onSelect,
}: {
  scale: ScaleDetail
  answers: Record<number, string>
  onSelect: (questionNo: number, value: string) => void
}) {
  const questions = getRenderableQuestions(scale, answers)
  const isIesr = scale.scaleCode === 'IESR'

  return (
    <div className="assessment-question-list">
      {isIesr ? (
        <div className="card stack">
          <strong>기간 안내</strong>
          <p className="muted" style={{ margin: 0 }}>
            IES-R는 &quot;지난 일주일 동안&quot; 어떠셨는지를 기준으로 응답합니다.
          </p>
        </div>
      ) : null}
      {questions.map((question) => {
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
