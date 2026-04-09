import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STATISTICS_ALERT_PAGE_SIZE,
  formatStatisticsAlertScaleLabel,
  formatStatisticsAlertTypeLabel,
  getStatisticsAlertTypeLabels,
  getStatisticsAlertTypeOptions,
  formatStatisticsScaleDropdownLabel,
  formatStatisticsScaleLabel,
  formatStatisticsScaleListLabel,
  formatStatisticsScaleOptionLabel,
} from '../src/pages/statistics/statisticsMetadata'

describe('statistics metadata', () => {
  it('keeps alert type metadata formatting, known scale labels, CRI handling, and the default page size stable', () => {
    const alertTypes = [
      { code: 'HIGH_RISK', label: '고위험' },
      { code: 'CAUTION', label: '주의' },
      { code: 'CRITICAL_ITEM', label: '개별 위험 항목' },
      { code: 'COMPOSITE_RULE', label: '복합 위험' },
    ]
    const alertTypeLabels = getStatisticsAlertTypeLabels(alertTypes)

    expect(DEFAULT_STATISTICS_ALERT_PAGE_SIZE).toBe(10)
    expect(getStatisticsAlertTypeOptions(alertTypes)).toEqual(['HIGH_RISK', 'CAUTION', 'CRITICAL_ITEM', 'COMPOSITE_RULE'])
    expect(alertTypeLabels).toEqual({
      HIGH_RISK: '고위험',
      CAUTION: '주의',
      CRITICAL_ITEM: '개별 위험 항목',
      COMPOSITE_RULE: '복합 위험',
    })

    expect(formatStatisticsAlertTypeLabel('CAUTION', alertTypeLabels)).toBe('주의')
    expect(formatStatisticsAlertTypeLabel('UNKNOWN', alertTypeLabels)).toBe('UNKNOWN')

    expect(
      formatStatisticsScaleLabel({
        scaleCode: 'PHQ9',
        scaleName: 'PHQ-9',
        selectionTitle: 'PHQ-9',
        selectionSubtitle: '우울',
      }),
    ).toBe('PHQ-9 (우울)')
    expect(formatStatisticsScaleLabel('CRI')).toBe('CRI')
    expect(formatStatisticsAlertScaleLabel('CRI')).toBe('CRI')
    expect(
      formatStatisticsScaleLabel({
        scaleCode: 'PHQ9',
        scaleName: 'PHQ-9',
        selectionTitle: 'PHQ-9 서버',
        selectionSubtitle: '우울 서버',
      }),
    ).toBe('PHQ-9 서버 (우울 서버)')

    expect(
      formatStatisticsScaleDropdownLabel({
        scaleCode: 'CRI',
        scaleName: '정신과적 위기 분류 평정척도 (CRI)',
        selectionTitle: 'CRI',
        selectionSubtitle: '정신과적 위기 분류 평정척도',
        totalCount: 5,
        alertCount: 2,
        isActive: true,
      }),
    ).toBe('CRI (정신과적 위기 분류 평정척도)')

    expect(
      formatStatisticsScaleListLabel({
        scaleCode: 'CRI',
        scaleName: '정신과적 위기 분류 평정척도 (CRI)',
        selectionTitle: 'CRI',
        selectionSubtitle: '정신과적 위기 분류 평정척도',
        totalCount: 5,
        alertCount: 2,
        isActive: true,
      }),
    ).toBe('정신과적 위기 분류 평정척도 (CRI)')

    expect(
      formatStatisticsScaleOptionLabel({
        scaleCode: 'OLDPHQ',
        scaleName: '구버전 PHQ',
        selectionTitle: '구버전 PHQ',
        totalCount: 4,
        alertCount: 1,
        isActive: false,
      }),
    ).toBe('구버전 PHQ (OLDPHQ) - 비활성')
  })
})
