const CRI_SCALE_CODE = 'CRI'
const CRI_NAME_SUFFIX = '(CRI)'
const CRI_DEFAULT_BASE_NAME = '정신과적 위기 분류 평정척도'

export interface ScaleDisplaySource {
  scaleCode: string
  scaleName?: string | null
  selectionTitle?: string | null
  selectionSubtitle?: string | null
  displayTitle?: string | null
  displaySubtitle?: string | null
}

interface NormalizedScaleDisplay {
  scaleCode: string
  scaleName: string
  title: string
  subtitle: string | null
}

interface ScaleSelectionLabelOptions {
  criMode?: 'titleOnly' | 'titleWithSubtitle' | 'fullScaleName'
  fallbackWithCode?: boolean
}

function trimToNull(value?: string | null) {
  const trimmed = value?.trim()

  return trimmed ? trimmed : null
}

export function isCriScaleCode(scaleCode?: string | null) {
  return trimToNull(scaleCode) === CRI_SCALE_CODE
}

export function normalizeScaleDisplaySource(source: ScaleDisplaySource | string, scaleName?: string): NormalizedScaleDisplay {
  if (typeof source === 'string') {
    const normalizedScaleCode = trimToNull(source) ?? source
    const normalizedScaleName = trimToNull(scaleName)

    return {
      scaleCode: normalizedScaleCode,
      scaleName: normalizedScaleName ?? normalizedScaleCode,
      title: normalizedScaleName ?? normalizedScaleCode,
      subtitle: null,
    }
  }

  const normalizedScaleCode = trimToNull(source.scaleCode) ?? source.scaleCode
  const normalizedScaleName = trimToNull(source.scaleName)
  const normalizedTitle =
    trimToNull(source.selectionTitle) ??
    trimToNull(source.displayTitle) ??
    normalizedScaleName ??
    normalizedScaleCode

  return {
    scaleCode: normalizedScaleCode,
    scaleName: normalizedScaleName ?? normalizedTitle,
    title: normalizedTitle,
    subtitle: trimToNull(source.selectionSubtitle) ?? trimToNull(source.displaySubtitle),
  }
}

export function formatScaleShortLabel(source: ScaleDisplaySource | string, scaleName?: string) {
  return normalizeScaleDisplaySource(source, scaleName).title
}

export function formatScaleSelectionLabel(
  source: ScaleDisplaySource | string,
  scaleNameOrOptions?: string | ScaleSelectionLabelOptions,
  maybeOptions?: ScaleSelectionLabelOptions,
) {
  const scaleName = typeof scaleNameOrOptions === 'string' ? scaleNameOrOptions : undefined
  const options = typeof scaleNameOrOptions === 'string' ? maybeOptions : scaleNameOrOptions
  const normalized = normalizeScaleDisplaySource(source, scaleName)
  const criMode = options?.criMode ?? 'titleOnly'

  if (isCriScaleCode(normalized.scaleCode)) {
    if (criMode === 'fullScaleName' && normalized.scaleName) {
      return normalized.scaleName
    }

    if (criMode === 'titleWithSubtitle' && normalized.subtitle) {
      return `${normalized.title} (${normalized.subtitle})`
    }

    return normalized.title
  }

  if (normalized.subtitle) {
    return `${normalized.title} (${normalized.subtitle})`
  }

  if (options?.fallbackWithCode) {
    return formatScaleNameWithCode(normalized.scaleCode, normalized.scaleName)
  }

  return normalized.title
}

export function formatScaleNameWithCode(scaleCode?: string | null, scaleName?: string | null) {
  const normalizedScaleCode = trimToNull(scaleCode)
  const normalizedScaleName = trimToNull(scaleName)

  if (!normalizedScaleName) {
    return normalizedScaleCode ?? ''
  }

  if (!normalizedScaleCode) {
    return normalizedScaleName
  }

  const scaleCodeSuffix = `(${normalizedScaleCode})`

  if (normalizedScaleName === normalizedScaleCode || normalizedScaleName.endsWith(scaleCodeSuffix)) {
    return normalizedScaleName
  }

  return `${normalizedScaleName} (${normalizedScaleCode})`
}

export function formatCriBaseName(scaleName?: string | null, fallbackSubtitle?: string | null) {
  const normalizedScaleName = trimToNull(scaleName)

  if (!normalizedScaleName) {
    return trimToNull(fallbackSubtitle) ?? CRI_DEFAULT_BASE_NAME
  }

  if (!normalizedScaleName.endsWith(CRI_NAME_SUFFIX)) {
    return normalizedScaleName
  }

  return normalizedScaleName.slice(0, -CRI_NAME_SUFFIX.length).trimEnd() || trimToNull(fallbackSubtitle) || CRI_DEFAULT_BASE_NAME
}
