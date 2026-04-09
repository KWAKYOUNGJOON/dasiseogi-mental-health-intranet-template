import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SIGNUP_REQUEST_PAGE_SIZE,
  DEFAULT_USER_MANAGEMENT_PAGE_SIZE,
  SIGNUP_REQUEST_PAGE_SIZE_OPTIONS,
  SIGNUP_REQUEST_STATUS_CHIP_STYLES,
  SIGNUP_REQUEST_STATUS_LABELS,
  SIGNUP_REQUEST_STATUS_OPTIONS,
  USER_MANAGEMENT_EDITABLE_STATUS_OPTIONS,
  USER_MANAGEMENT_PAGE_SIZE_OPTIONS,
  USER_MANAGEMENT_POSITION_NAME_OPTIONS,
  USER_MANAGEMENT_ROLE_CHIP_STYLES,
  USER_MANAGEMENT_ROLE_LABELS,
  USER_MANAGEMENT_ROLE_OPTIONS,
  USER_MANAGEMENT_STATUS_CHIP_STYLES,
  USER_MANAGEMENT_STATUS_LABELS,
  USER_MANAGEMENT_STATUS_OPTIONS,
  SIGNUP_REQUEST_PROCESSABLE_STATUS,
  getDefaultSignupRequestFilterStatus,
  getDefaultUserManagementStatusDraft,
  isSignupRequestProcessableStatus,
  isUserManagementEditableStatus,
  parseSignupRequestPageSize,
  parseUserManagementPageSize,
} from '../src/features/admin/adminManagementMetadata'
import {
  USER_ROLE_LABELS,
  USER_ROLE_OPTIONS,
  USER_STATUS_LABELS,
  USER_STATUS_OPTIONS,
} from '../src/shared/user/userMetadata'

describe('admin management metadata', () => {
  it('keeps the shared options, labels, chip styles, and helper fallbacks stable', () => {
    expect(USER_MANAGEMENT_ROLE_OPTIONS).toEqual(['ADMIN', 'USER'])
    expect(USER_MANAGEMENT_STATUS_OPTIONS).toEqual(['ACTIVE', 'PENDING', 'INACTIVE', 'REJECTED'])
    expect(USER_MANAGEMENT_ROLE_OPTIONS).toBe(USER_ROLE_OPTIONS)
    expect(USER_MANAGEMENT_STATUS_OPTIONS).toBe(USER_STATUS_OPTIONS)
    expect(USER_MANAGEMENT_EDITABLE_STATUS_OPTIONS).toEqual(['ACTIVE', 'INACTIVE'])
    expect(USER_MANAGEMENT_POSITION_NAME_OPTIONS).toEqual(['팀장', '대리', '실무자'])
    expect(USER_MANAGEMENT_PAGE_SIZE_OPTIONS).toEqual([20, 50])

    expect(SIGNUP_REQUEST_STATUS_OPTIONS).toEqual(['PENDING', 'APPROVED', 'REJECTED'])
    expect(SIGNUP_REQUEST_PAGE_SIZE_OPTIONS).toEqual([20, 50, 100])

    expect(USER_MANAGEMENT_ROLE_LABELS).toEqual({
      ADMIN: '관리자',
      USER: '일반 사용자',
    })
    expect(USER_MANAGEMENT_ROLE_LABELS).toBe(USER_ROLE_LABELS)
    expect(USER_MANAGEMENT_STATUS_LABELS).toEqual({
      ACTIVE: '활성',
      PENDING: '승인 대기',
      INACTIVE: '비활성',
      REJECTED: '반려',
    })
    expect(USER_MANAGEMENT_STATUS_LABELS).toBe(USER_STATUS_LABELS)
    expect(SIGNUP_REQUEST_STATUS_LABELS).toEqual({
      PENDING: '승인 대기',
      APPROVED: '승인 완료',
      REJECTED: '반려',
    })

    expect(USER_MANAGEMENT_ROLE_CHIP_STYLES).toEqual({
      ADMIN: {
        color: '#204e72',
        background: '#dceaf7',
      },
      USER: {
        color: '#576b7d',
        background: '#e9eef3',
      },
    })
    expect(USER_MANAGEMENT_STATUS_CHIP_STYLES).toEqual({
      ACTIVE: {
        color: '#1d6a53',
        background: '#dff1ea',
      },
      PENDING: {
        color: '#1d537d',
        background: '#dceaf7',
      },
      INACTIVE: {
        color: '#8c5a11',
        background: '#f8e8cf',
      },
      REJECTED: {
        color: '#9d2f2f',
        background: '#f8e1e1',
      },
    })
    expect(SIGNUP_REQUEST_STATUS_CHIP_STYLES).toEqual({
      PENDING: {
        color: '#1d537d',
        background: '#dceaf7',
      },
      APPROVED: {
        color: '#1d6a53',
        background: '#dff1ea',
      },
      REJECTED: {
        color: '#9d2f2f',
        background: '#f8e1e1',
      },
    })

    expect(isUserManagementEditableStatus('ACTIVE')).toBe(true)
    expect(isUserManagementEditableStatus('INACTIVE')).toBe(true)
    expect(isUserManagementEditableStatus('PENDING')).toBe(false)
    expect(isUserManagementEditableStatus('REJECTED')).toBe(false)
    expect(getDefaultUserManagementStatusDraft('ACTIVE')).toBe('ACTIVE')
    expect(getDefaultUserManagementStatusDraft('INACTIVE')).toBe('INACTIVE')
    expect(getDefaultUserManagementStatusDraft('PENDING')).toBe('')
    expect(getDefaultUserManagementStatusDraft('REJECTED')).toBe('')

    expect(parseUserManagementPageSize('50')).toBe(50)
    expect(parseUserManagementPageSize('100')).toBe(DEFAULT_USER_MANAGEMENT_PAGE_SIZE)
    expect(parseSignupRequestPageSize('100')).toBe(100)
    expect(parseSignupRequestPageSize('10')).toBe(DEFAULT_SIGNUP_REQUEST_PAGE_SIZE)
    expect(getDefaultSignupRequestFilterStatus()).toBe('PENDING')
    expect(SIGNUP_REQUEST_PROCESSABLE_STATUS).toBe('PENDING')
    expect(isSignupRequestProcessableStatus('PENDING')).toBe(true)
    expect(isSignupRequestProcessableStatus('APPROVED')).toBe(false)
    expect(isSignupRequestProcessableStatus('REJECTED')).toBe(false)
  })
})
