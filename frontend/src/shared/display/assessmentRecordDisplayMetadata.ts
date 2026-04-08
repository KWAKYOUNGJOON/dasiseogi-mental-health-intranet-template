const DEFAULT_ASSESSMENT_RECORD_SESSION_STATUS_CHIP_CLASS_NAME = 'status-chip'
const DANGER_ASSESSMENT_RECORD_SESSION_STATUS_CHIP_CLASS_NAME = 'status-chip status-chip-danger'
const EMPTY_ASSESSMENT_RECORD_SESSION_STATUS_LABEL = '상태 미확인'
const EMPTY_ASSESSMENT_RECORD_SESSION_STATUS_DATA_STATUS = 'UNKNOWN'

interface AssessmentRecordSessionStatusDisplayMetadata {
  chipClassName: string
  dataStatus: string
  label: string
}

const ASSESSMENT_RECORD_SESSION_STATUS_DISPLAY_METADATA: Readonly<
  Record<string, AssessmentRecordSessionStatusDisplayMetadata>
> = {
  COMPLETED: {
    chipClassName: DEFAULT_ASSESSMENT_RECORD_SESSION_STATUS_CHIP_CLASS_NAME,
    dataStatus: 'COMPLETED',
    label: '정상',
  },
  MISENTERED: {
    chipClassName: DANGER_ASSESSMENT_RECORD_SESSION_STATUS_CHIP_CLASS_NAME,
    dataStatus: 'MISENTERED',
    label: '오입력',
  },
}

function normalizeAssessmentRecordSessionStatus(status: string | null | undefined) {
  return typeof status === 'string' ? status.trim() : ''
}

export function getAssessmentRecordSessionStatusDisplayMetadata(status: string | null | undefined) {
  const normalizedStatus = normalizeAssessmentRecordSessionStatus(status)

  if (!normalizedStatus) {
    return {
      chipClassName: DEFAULT_ASSESSMENT_RECORD_SESSION_STATUS_CHIP_CLASS_NAME,
      dataStatus: EMPTY_ASSESSMENT_RECORD_SESSION_STATUS_DATA_STATUS,
      label: EMPTY_ASSESSMENT_RECORD_SESSION_STATUS_LABEL,
    }
  }

  return (
    ASSESSMENT_RECORD_SESSION_STATUS_DISPLAY_METADATA[normalizedStatus] ?? {
      chipClassName: DEFAULT_ASSESSMENT_RECORD_SESSION_STATUS_CHIP_CLASS_NAME,
      dataStatus: normalizedStatus,
      label: normalizedStatus,
    }
  )
}

export function getAssessmentRecordSessionStatusLabel(status: string | null | undefined) {
  return getAssessmentRecordSessionStatusDisplayMetadata(status).label
}

export function getAssessmentRecordSessionStatusChipClassName(status: string | null | undefined) {
  return getAssessmentRecordSessionStatusDisplayMetadata(status).chipClassName
}

export function getAssessmentRecordSessionStatusDataStatus(status: string | null | undefined) {
  return getAssessmentRecordSessionStatusDisplayMetadata(status).dataStatus
}
