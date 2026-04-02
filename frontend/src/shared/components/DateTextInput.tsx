import type { InputHTMLAttributes } from 'react'
import { formatCompactDateInput } from '../utils/dateText'

type DateTextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> & {
  onChange: (value: string) => void
  value: string
}

export function DateTextInput({
  inputMode = 'numeric',
  maxLength = 10,
  onChange,
  placeholder = '연도. 월. 일.',
  value,
  ...rest
}: DateTextInputProps) {
  return (
    <input
      {...rest}
      inputMode={inputMode}
      maxLength={maxLength}
      onChange={(event) => onChange(formatCompactDateInput(event.target.value))}
      placeholder={placeholder}
      type="text"
      value={value}
    />
  )
}
