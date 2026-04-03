const SEOUL_TIME_ZONE = 'Asia/Seoul'
const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/

const seoulDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SEOUL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function getSeoulDateTimeParts(value: Date) {
  const parts = seoulDateTimeFormatter.formatToParts(value)
  const lookup = new Map(parts.map((part) => [part.type, part.value]))

  return {
    year: lookup.get('year') ?? '',
    month: lookup.get('month') ?? '',
    day: lookup.get('day') ?? '',
    hour: lookup.get('hour') ?? '',
    minute: lookup.get('minute') ?? '',
    second: lookup.get('second') ?? '',
  }
}

function toSeoulDateTimeText(value: Date) {
  const { year, month, day, hour, minute, second } = getSeoulDateTimeParts(value)

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`
}

function toSeoulDisplayDateTimeText(value: Date) {
  return toSeoulDateTimeText(value).replace('T', ' ')
}

function toLocalDateTimeText(parts: {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}) {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}`
}

function toLocalDisplayDateTimeText(parts: {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}) {
  return toLocalDateTimeText(parts).replace('T', ' ')
}

function parseLocalDateTimeText(value: string) {
  const match = value.trim().match(LOCAL_DATETIME_PATTERN)

  if (!match) {
    return null
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? '00'),
  }
}

export function getTodayDateText() {
  return createCurrentSeoulDateTimeText().slice(0, 10)
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

export function createCurrentSeoulDateTimeText(now = new Date()) {
  return toSeoulDateTimeText(now)
}

function hasExplicitTimeZoneOffset(value: string) {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value.trim())
}

function formatLocalDateTimeTextInSeoul(value: string) {
  const localDateTime = parseLocalDateTimeText(value)

  if (!localDateTime) {
    return value
  }

  return toLocalDisplayDateTimeText(localDateTime)
}

function formatOffsetDateTimeTextInSeoul(value: string) {
  const parsedValue = new Date(value)

  if (Number.isNaN(parsedValue.getTime())) {
    return value
  }

  return toSeoulDisplayDateTimeText(parsedValue)
}

export function formatSeoulDateTimeText(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  if (hasExplicitTimeZoneOffset(value)) {
    return formatOffsetDateTimeTextInSeoul(value)
  }

  return formatLocalDateTimeTextInSeoul(value)
}

// Assessment APIs currently return timezone-less local datetime text in KST.
export function formatAssessmentLocalDateTimeText(value: string | null | undefined) {
  return formatSeoulDateTimeText(value)
}

export function formatOffsetDateTimeTextToSeoul(value: string | null | undefined) {
  return formatSeoulDateTimeText(value)
}
