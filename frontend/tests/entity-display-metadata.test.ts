import { describe, expect, it } from 'vitest'
import {
  CLIENT_GENDER_OPTIONS,
  CLIENT_GENDER_LABELS,
  CLIENT_STATUS_LABELS,
  SESSION_STATUS_LABELS,
  getClientGenderLabel,
  getClientStatusLabel,
  getSessionStatusLabel,
} from '../src/shared/display/entityDisplayMetadata'

describe('entity display metadata', () => {
  it('exports the expected client gender options and client/session display labels', () => {
    expect(CLIENT_GENDER_OPTIONS).toEqual([
      { value: 'MALE', label: '남성' },
      { value: 'FEMALE', label: '여성' },
      { value: 'OTHER', label: '기타' },
      { value: 'UNKNOWN', label: '미상' },
    ])
    expect(CLIENT_GENDER_LABELS).toEqual({
      MALE: '남성',
      FEMALE: '여성',
    })
    expect(CLIENT_STATUS_LABELS).toEqual({
      ACTIVE: '활성',
      INACTIVE: '비활성',
      MISREGISTERED: '오등록',
    })
    expect(SESSION_STATUS_LABELS).toEqual({
      COMPLETED: '완료',
      MISENTERED: '오입력',
    })
  })

  it('returns the shared Korean labels for known client and session values', () => {
    expect(getClientGenderLabel('MALE')).toBe('남성')
    expect(getClientGenderLabel('FEMALE')).toBe('여성')
    expect(getClientStatusLabel('ACTIVE')).toBe('활성')
    expect(getClientStatusLabel('INACTIVE')).toBe('비활성')
    expect(getClientStatusLabel('MISREGISTERED')).toBe('오등록')
    expect(getSessionStatusLabel('COMPLETED')).toBe('완료')
    expect(getSessionStatusLabel('MISENTERED')).toBe('오입력')
  })

  it('falls back to the raw value for unknown codes and to a dash for empty values', () => {
    expect(getClientGenderLabel('UNKNOWN_GENDER')).toBe('UNKNOWN_GENDER')
    expect(getClientStatusLabel('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS')
    expect(getSessionStatusLabel('UNKNOWN_SESSION_STATUS')).toBe('UNKNOWN_SESSION_STATUS')
    expect(getClientGenderLabel('')).toBe('-')
    expect(getClientStatusLabel(undefined)).toBe('-')
    expect(getSessionStatusLabel(null)).toBe('-')
  })
})
