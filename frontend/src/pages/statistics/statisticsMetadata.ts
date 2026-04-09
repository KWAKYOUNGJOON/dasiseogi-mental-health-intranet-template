import type {
  StatisticsAlertItem,
  StatisticsAlertTypeMetadataItem,
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

export type StatisticsAlertTypeLabelMap = Record<string, string>

export function getStatisticsAlertTypeOptions(alertTypes: StatisticsAlertTypeMetadataItem[]) {
  return alertTypes.map((item) => item.code)
}

export function getStatisticsAlertTypeLabels(alertTypes: StatisticsAlertTypeMetadataItem[]) {
  return alertTypes.reduce<StatisticsAlertTypeLabelMap>((labels, item) => {
    labels[item.code] = item.label
    return labels
  }, {})
}

export function formatStatisticsAlertTypeLabel(alertType: string, alertTypeLabels: StatisticsAlertTypeLabelMap) {
  return alertTypeLabels[alertType] ?? alertType
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
