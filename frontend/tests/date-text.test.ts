import { describe, expect, it } from 'vitest'
import { formatCompactDateInput, toValidDateText } from '../src/shared/utils/dateText'

describe('date text utilities', () => {
  it('clamps the month to December when a larger month is entered', () => {
    expect(formatCompactDateInput('202613')).toBe('2026-12')
  })

  it('clamps the day to the last day of the selected month', () => {
    expect(formatCompactDateInput('20260431')).toBe('2026-04-30')
  })

  it('keeps February 29 on leap years', () => {
    expect(formatCompactDateInput('20240229')).toBe('2024-02-29')
    expect(toValidDateText('2024-02-29')).toBe('2024-02-29')
  })

  it('clamps February 29 to February 28 on non-leap years', () => {
    expect(formatCompactDateInput('20250229')).toBe('2025-02-28')
  })
})
