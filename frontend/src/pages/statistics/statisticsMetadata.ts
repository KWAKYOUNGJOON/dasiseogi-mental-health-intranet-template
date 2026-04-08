import type {
  StatisticsAlertItem,
  StatisticsScaleDisplayMetadata,
  StatisticsScaleItem,
} from '../../features/statistics/api/statisticsApi'

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

export const STATISTICS_SCALE_DISPLAY_TITLE_BY_CODE: Record<string, string> = {
  PHQ9: 'PHQ-9',
  GAD7: 'GAD-7',
  MKPQ16: 'mKPQ-16',
  KMDQ: 'K-MDQ',
  PSS10: 'PSS-10',
  ISIK: 'ISI-K',
  AUDITK: 'AUDIT-K',
  IESR: 'IES-R',
}

export const STATISTICS_SCALE_DESCRIPTION_BY_CODE: Record<string, string> = {
  PHQ9: '우울',
  GAD7: '불안',
  MKPQ16: '정신증 위험',
  KMDQ: '양극성(조울증)',
  PSS10: '스트레스',
  ISIK: '불면',
  AUDITK: '알코올 사용',
  IESR: '외상 후 스트레스(PTSD)',
}

export const STATISTICS_CRI_METADATA = {
  scaleCode: 'CRI',
  defaultBaseName: '정신과적 위기 분류 평정척도',
  nameSuffix: '(CRI)',
} as const

export function formatStatisticsAlertTypeLabel(alertType: string) {
  return STATISTICS_ALERT_TYPE_LABELS[alertType as StatisticsAlertTypeOption] ?? alertType
}

export function isStatisticsCriScaleCode(scaleCode: string) {
  return scaleCode === STATISTICS_CRI_METADATA.scaleCode
}

export function formatStatisticsScaleLabel(scale: StatisticsScaleDisplaySource | string, scaleName?: string) {
  const source = normalizeStatisticsScaleDisplaySource(scale, scaleName)
  const title = resolveStatisticsScaleDisplayTitle(source)
  const subtitle = resolveStatisticsScaleDisplaySubtitle(source)

  if (isStatisticsCriScaleCode(source.scaleCode)) {
    return title
  }

  if (subtitle) {
    return `${title} (${subtitle})`
  }

  return title
}

export function formatStatisticsCriBaseName(scaleName?: string) {
  const trimmedScaleName = scaleName?.trim()

  if (!trimmedScaleName) {
    return STATISTICS_CRI_METADATA.defaultBaseName
  }

  if (!trimmedScaleName.endsWith(STATISTICS_CRI_METADATA.nameSuffix)) {
    return trimmedScaleName
  }

  return trimmedScaleName.slice(0, -STATISTICS_CRI_METADATA.nameSuffix.length).trimEnd()
}

function normalizeStatisticsScaleDisplaySource(
  scale: StatisticsScaleDisplaySource | string,
  scaleName?: string,
): StatisticsScaleDisplaySource {
  if (typeof scale !== 'string') {
    return scale
  }

  return {
    scaleCode: scale,
    scaleName: scaleName ?? STATISTICS_SCALE_DISPLAY_TITLE_BY_CODE[scale] ?? scale,
    displayTitle: undefined,
    displaySubtitle: undefined,
  }
}

function resolveStatisticsScaleDisplayTitle(source: StatisticsScaleDisplaySource) {
  const displayTitle = source.displayTitle?.trim()

  if (displayTitle) {
    return displayTitle
  }

  const fallbackTitle = STATISTICS_SCALE_DISPLAY_TITLE_BY_CODE[source.scaleCode]
  if (fallbackTitle) {
    return fallbackTitle
  }

  const scaleName = source.scaleName?.trim()
  if (scaleName) {
    return scaleName
  }

  return source.scaleCode
}

function resolveStatisticsScaleDisplaySubtitle(source: StatisticsScaleDisplaySource) {
  const displaySubtitle = source.displaySubtitle?.trim()

  if (displaySubtitle) {
    return displaySubtitle
  }

  return STATISTICS_SCALE_DESCRIPTION_BY_CODE[source.scaleCode]
}

function formatStatisticsScaleNameWithCode(scaleCode: string, scaleName: string) {
  const trimmedScaleName = scaleName.trimEnd()
  const scaleCodeSuffix = `(${scaleCode})`

  if (trimmedScaleName.endsWith(scaleCodeSuffix)) {
    return trimmedScaleName
  }

  return `${trimmedScaleName} ${scaleCodeSuffix}`
}

function resolveStatisticsCriBaseName(item: StatisticsScaleItem | StatisticsAlertItem) {
  if (item.scaleName?.trim()) {
    return formatStatisticsCriBaseName(item.scaleName)
  }

  if (item.displaySubtitle?.trim()) {
    return formatStatisticsCriBaseName(item.displaySubtitle)
  }

  return STATISTICS_CRI_METADATA.defaultBaseName
}

export function formatStatisticsScaleDropdownLabel(item: StatisticsScaleItem) {
  if (isStatisticsCriScaleCode(item.scaleCode)) {
    return `${resolveStatisticsScaleDisplayTitle(item)} (${resolveStatisticsCriBaseName(item)})`
  }

  const subtitle = resolveStatisticsScaleDisplaySubtitle(item)
  if (subtitle) {
    return `${resolveStatisticsScaleDisplayTitle(item)} (${subtitle})`
  }

  return formatStatisticsScaleNameWithCode(item.scaleCode, resolveStatisticsScaleDisplayTitle(item))
}

export function formatStatisticsScaleListLabel(item: StatisticsScaleItem) {
  if (isStatisticsCriScaleCode(item.scaleCode)) {
    const scaleName = item.scaleName?.trim()

    if (scaleName) {
      return scaleName
    }

    return `${resolveStatisticsCriBaseName(item)} (${resolveStatisticsScaleDisplayTitle(item)})`
  }

  return formatStatisticsScaleLabel(item)
}

export function formatStatisticsAlertScaleLabel(item: StatisticsAlertItem | StatisticsScaleDisplaySource | string, scaleName?: string) {
  return formatStatisticsScaleLabel(item, scaleName)
}

export function formatStatisticsScaleOptionLabel(item: StatisticsScaleItem) {
  const displayLabel = formatStatisticsScaleDropdownLabel(item)

  return `${displayLabel}${item.isActive ? '' : ' - 비활성'}`
}
