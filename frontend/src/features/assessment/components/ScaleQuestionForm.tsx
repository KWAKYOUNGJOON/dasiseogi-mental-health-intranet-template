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
        <div className="question-block" key={question.questionNo}>
          <strong>
            {question.questionNo}. {question.questionText}
          </strong>
          <div className="option-list">
            {question.options.map((option) => (
              <label className="option-item" key={option.value}>
                <input
                  checked={answers[question.questionNo] === option.value}
                  name={`${scale.scaleCode}-${question.questionNo}`}
                  onChange={() => onSelect(question.questionNo, option.value)}
                  type="radio"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
