import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STATISTICS_ALERT_PAGE_SIZE,
  STATISTICS_ALERT_TYPE_LABELS,
  STATISTICS_ALERT_TYPE_OPTIONS,
  formatStatisticsAlertScaleLabel,
  formatStatisticsAlertTypeLabel,
  formatStatisticsScaleDropdownLabel,
  formatStatisticsScaleLabel,
  formatStatisticsScaleListLabel,
  formatStatisticsScaleOptionLabel,
} from '../src/pages/statistics/statisticsMetadata'

describe('statistics metadata', () => {
  it('keeps alert type labels, known scale labels, CRI handling, and the default page size stable', () => {
    expect(DEFAULT_STATISTICS_ALERT_PAGE_SIZE).toBe(10)
    expect(STATISTICS_ALERT_TYPE_OPTIONS).toEqual(['HIGH_RISK', 'CAUTION', 'CRITICAL_ITEM', 'COMPOSITE_RULE'])
    expect(STATISTICS_ALERT_TYPE_LABELS).toEqual({
      HIGH_RISK: '고위험',
      CAUTION: '주의',
      CRITICAL_ITEM: '개별 위험 항목',
      COMPOSITE_RULE: '복합 위험',
    })

    expect(formatStatisticsAlertTypeLabel('CAUTION')).toBe('주의')
    expect(formatStatisticsAlertTypeLabel('UNKNOWN')).toBe('UNKNOWN')

    expect(formatStatisticsScaleLabel('PHQ9')).toBe('PHQ-9 (우울)')
    expect(formatStatisticsScaleLabel('CRI')).toBe('CRI')
    expect(formatStatisticsAlertScaleLabel('CRI')).toBe('CRI')

    expect(
      formatStatisticsScaleDropdownLabel({
        scaleCode: 'CRI',
        scaleName: '정신과적 위기 분류 평정척도 (CRI)',
        totalCount: 5,
        alertCount: 2,
        isActive: true,
      }),
    ).toBe('CRI (정신과적 위기 분류 평정척도)')

    expect(
      formatStatisticsScaleListLabel({
        scaleCode: 'CRI',
        scaleName: '정신과적 위기 분류 평정척도 (CRI)',
        totalCount: 5,
        alertCount: 2,
        isActive: true,
      }),
    ).toBe('정신과적 위기 분류 평정척도 (CRI)')

    expect(
      formatStatisticsScaleOptionLabel({
        scaleCode: 'OLDPHQ',
        scaleName: '구버전 PHQ',
        totalCount: 4,
        alertCount: 1,
        isActive: false,
      }),
    ).toBe('구버전 PHQ (OLDPHQ) - 비활성')
  })
})
