import { describe, expect, it } from 'vitest'
import {
  getAssessmentRecordSessionStatusChipClassName,
  getAssessmentRecordSessionStatusDataStatus,
  getAssessmentRecordSessionStatusDisplayMetadata,
  getAssessmentRecordSessionStatusLabel,
} from '../src/shared/display/assessmentRecordDisplayMetadata'

describe('assessment record display metadata', () => {
  it('returns the misentered label and danger chip class for MISENTERED', () => {
    expect(getAssessmentRecordSessionStatusLabel('MISENTERED')).toBe('오입력')
    expect(getAssessmentRecordSessionStatusChipClassName('MISENTERED')).toBe('status-chip status-chip-danger')
    expect(getAssessmentRecordSessionStatusDataStatus('MISENTERED')).toBe('MISENTERED')
  })

  it('returns the normal label and default chip class for COMPLETED', () => {
    expect(getAssessmentRecordSessionStatusLabel('COMPLETED')).toBe('정상')
    expect(getAssessmentRecordSessionStatusChipClassName('COMPLETED')).toBe('status-chip')
    expect(getAssessmentRecordSessionStatusDataStatus('COMPLETED')).toBe('COMPLETED')
  })

  it('falls back to the raw status and default chip styling for unknown values', () => {
    expect(getAssessmentRecordSessionStatusLabel('PENDING_REVIEW')).toBe('PENDING_REVIEW')
    expect(getAssessmentRecordSessionStatusChipClassName('PENDING_REVIEW')).toBe('status-chip')
    expect(getAssessmentRecordSessionStatusDataStatus('PENDING_REVIEW')).toBe('PENDING_REVIEW')
  })

  it('returns an explicit empty fallback when the status is missing', () => {
    expect(getAssessmentRecordSessionStatusDisplayMetadata('  ')).toEqual({
      chipClassName: 'status-chip',
      dataStatus: 'UNKNOWN',
      label: '상태 미확인',
    })
    expect(getAssessmentRecordSessionStatusLabel(undefined)).toBe('상태 미확인')
    expect(getAssessmentRecordSessionStatusDataStatus(null)).toBe('UNKNOWN')
  })
})
