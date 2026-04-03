import { describe, expect, it } from 'vitest'
import {
  createCurrentSeoulDateTimeText,
  formatAssessmentLocalDateTimeText,
  formatCompactDateInput,
  formatOffsetDateTimeTextToSeoul,
  getDefaultStatisticsSeoulDateRange,
  formatSeoulDateText,
  formatSeoulDateTimeText,
  getCurrentSeoulWeekRange,
  getTodayDateText,
  toValidDateText,
} from '../src/shared/utils/dateText'

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

  it('builds the current save datetime text in Asia/Seoul', () => {
    expect(createCurrentSeoulDateTimeText(new Date('2026-03-31T00:20:30Z'))).toBe('2026-03-31T09:20:30')
  })

  it('builds the current Seoul date text independent from the browser local timezone', () => {
    expect(formatSeoulDateText(new Date('2026-03-30T15:30:00Z'))).toBe('2026-03-31')
  })

  it('returns today date text in Asia/Seoul', () => {
    expect(getTodayDateText()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('keeps assessment api local datetime text unchanged for display', () => {
    expect(formatAssessmentLocalDateTimeText('2026-03-31T09:20:00')).toBe('2026-03-31 09:20:00')
  })

  it('converts offset datetime strings to Asia/Seoul in the shared display formatter', () => {
    expect(formatAssessmentLocalDateTimeText('2026-03-31T00:20:00Z')).toBe('2026-03-31 09:20:00')
  })

  it('converts offset-based datetime text to Asia/Seoul only in the offset formatter', () => {
    expect(formatOffsetDateTimeTextToSeoul('2026-03-31T00:20:00Z')).toBe('2026-03-31 09:20:00')
  })

  it('keeps already formatted Seoul datetime text stable for display', () => {
    expect(formatSeoulDateTimeText('2026-03-31 09:20:00')).toBe('2026-03-31 09:20:00')
  })

  it('calculates the default statistics range from seven days ago to today in Asia/Seoul', () => {
    expect(getDefaultStatisticsSeoulDateRange(new Date('2026-04-02T15:00:00Z'))).toEqual({
      dateFrom: '2026-03-27',
      dateTo: '2026-04-03',
    })
  })

  it('keeps late UTC hours inside the same Seoul day for the default statistics range', () => {
    expect(getDefaultStatisticsSeoulDateRange(new Date('2026-04-03T14:59:59Z'))).toEqual({
      dateFrom: '2026-03-27',
      dateTo: '2026-04-03',
    })
  })

  it('calculates the default statistics week range from Monday to Sunday in Asia/Seoul', () => {
    expect(getCurrentSeoulWeekRange(new Date('2026-03-29T15:30:00Z'))).toEqual({
      dateFrom: '2026-03-30',
      dateTo: '2026-04-05',
    })
  })

  it('keeps Sunday night UTC inside the same Seoul week until Seoul Monday starts', () => {
    expect(getCurrentSeoulWeekRange(new Date('2026-04-05T14:59:59Z'))).toEqual({
      dateFrom: '2026-03-30',
      dateTo: '2026-04-05',
    })
  })

  it('starts a new Seoul week exactly at Seoul Monday even if UTC is still Sunday', () => {
    expect(getCurrentSeoulWeekRange(new Date('2026-04-05T15:00:00Z'))).toEqual({
      dateFrom: '2026-04-06',
      dateTo: '2026-04-12',
    })
  })
})
