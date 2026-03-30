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
    <div className="stack">
      {scale.questions.map((question) => (
        <fieldset className="question-block field" key={question.questionNo} style={{ margin: 0 }}>
          <legend style={{ fontWeight: 700, padding: 0 }}>
            {question.questionNo}. {question.questionText}
          </legend>
          <div className="option-list">
            {question.options.map((option) => (
              <label className="option-item" key={option.value}>
                <input
                  checked={answers[question.questionNo] === option.value}
                  name={`${scale.scaleCode}-${question.questionNo}`}
                  onChange={() => onSelect(question.questionNo, option.value)}
                  type="radio"
                  value={option.value}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
