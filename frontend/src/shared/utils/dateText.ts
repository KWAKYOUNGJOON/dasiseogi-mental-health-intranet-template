export function getTodayDateText() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000

  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function normalizeMonthText(monthText: string) {
  if (monthText.length < 2) {
    return monthText
  }

  const month = clamp(Number(monthText), 1, 12)

  return String(month).padStart(2, '0')
}

function normalizeDayText(dayText: string, yearText: string, monthText: string) {
  if (dayText.length < 2) {
    return dayText
  }

  if (yearText.length < 4 || monthText.length < 2) {
    return dayText
  }

  const year = Number(yearText)
  const month = Number(monthText)
  const maxDay = getDaysInMonth(year, month)
  const day = clamp(Number(dayText), 1, maxDay)

  return String(day).padStart(2, '0')
}

export function isValidDateText(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsedDate = new Date(Date.UTC(year, month - 1, day))

  if (Number.isNaN(parsedDate.getTime())) {
    return false
  }

  return parsedDate.getUTCFullYear() === year && parsedDate.getUTCMonth() === month - 1 && parsedDate.getUTCDate() === day
}

export function formatCompactDateInput(value: string) {
  const digitsOnly = value.replace(/\D/g, '').slice(0, 8)
  const yearText = digitsOnly.slice(0, 4)
  const monthText = normalizeMonthText(digitsOnly.slice(4, 6))
  const dayText = normalizeDayText(digitsOnly.slice(6, 8), yearText, monthText)

  if (digitsOnly.length <= 4) {
    return yearText
  }

  if (digitsOnly.length <= 6) {
    return `${yearText}-${monthText}`
  }

  return `${yearText}-${monthText}-${dayText}`
}

export function toValidDateText(value: string) {
  const formattedValue = formatCompactDateInput(value)

  return isValidDateText(formattedValue) ? formattedValue : ''
}
