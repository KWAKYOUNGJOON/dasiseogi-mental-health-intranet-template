import type {
  StatisticsAlertItem,
  StatisticsScaleDisplayMetadata,
  StatisticsScaleItem,
} from '../../features/statistics/api/statisticsApi'
import {
  formatCriBaseName,
  formatScaleNameWithCode,
  formatScaleSelectionLabel,
  isCriScaleCode,
  normalizeScaleDisplaySource,
} from '../../shared/scales/scaleDisplay'

type StatisticsScaleDisplaySource = StatisticsScaleDisplayMetadata

export const DEFAULT_STATISTICS_ALERT_PAGE_SIZE = 10

export const STATISTICS_ALERT_TYPE_OPTIONS = ['HIGH_RISK', 'CAUTION', 'CRITICAL_ITEM', 'COMPOSITE_RULE'] as const

export type StatisticsAlertTypeOption = (typeof STATISTICS_ALERT_TYPE_OPTIONS)[number]

export const STATISTICS_ALERT_TYPE_LABELS: Record<StatisticsAlertTypeOption, string> = {
  HIGH_RISK: '고위험',
  CAUTION: '주의',
  CRITICAL_ITEM: '개별 위험 항목',
  COMPOSITE_RULE: '복합 위험',
}

export function formatStatisticsAlertTypeLabel(alertType: string) {
  return STATISTICS_ALERT_TYPE_LABELS[alertType as StatisticsAlertTypeOption] ?? alertType
}

export function formatStatisticsScaleLabel(scale: StatisticsScaleDisplaySource | string, scaleName?: string) {
  return formatScaleSelectionLabel(scale, scaleName, { criMode: 'titleOnly' })
}

export function formatStatisticsCriBaseName(scaleName?: string) {
  return formatCriBaseName(scaleName)
}

function resolveStatisticsCriBaseName(item: StatisticsScaleItem | StatisticsAlertItem) {
  return formatCriBaseName(item.scaleName, item.selectionSubtitle ?? item.displaySubtitle)
}

export function formatStatisticsScaleDropdownLabel(item: StatisticsScaleItem) {
  return formatScaleSelectionLabel(item, {
    criMode: 'titleWithSubtitle',
    fallbackWithCode: true,
  })
}

export function formatStatisticsScaleListLabel(item: StatisticsScaleItem) {
  if (!isCriScaleCode(item.scaleCode)) {
    return formatStatisticsScaleLabel(item)
  }

  const normalized = normalizeScaleDisplaySource(item)
  const scaleName = item.scaleName?.trim()

  if (scaleName) {
    return scaleName
  }

  return `${resolveStatisticsCriBaseName(item)} (${normalized.title})`
}

export function formatStatisticsAlertScaleLabel(item: StatisticsAlertItem | StatisticsScaleDisplaySource | string, scaleName?: string) {
  return formatStatisticsScaleLabel(item, scaleName)
}

export function formatStatisticsScaleOptionLabel(item: StatisticsScaleItem) {
  const normalized = normalizeScaleDisplaySource(item)
  const displayLabel =
    normalized.subtitle || isCriScaleCode(normalized.scaleCode)
      ? formatStatisticsScaleDropdownLabel(item)
      : formatScaleNameWithCode(normalized.scaleCode, normalized.scaleName)

  return `${displayLabel}${item.isActive ? '' : ' - 비활성'}`
}
