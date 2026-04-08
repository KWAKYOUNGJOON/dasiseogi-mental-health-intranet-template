import { describe, expect, it } from 'vitest'
import {
  USER_ROLE_LABELS,
  USER_ROLE_OPTIONS,
  USER_STATUS_LABELS,
  USER_STATUS_OPTIONS,
  getUserRoleLabel,
  getUserStatusLabel,
  hasAdminAccess,
  isAdminRole,
} from '../src/shared/user/userMetadata'

describe('user domain metadata', () => {
  it('keeps role/status options, labels, and admin access helpers stable', () => {
    expect(USER_ROLE_OPTIONS).toEqual(['ADMIN', 'USER'])
    expect(USER_STATUS_OPTIONS).toEqual(['ACTIVE', 'PENDING', 'INACTIVE', 'REJECTED'])

    expect(USER_ROLE_LABELS).toEqual({
      ADMIN: '관리자',
      USER: '일반 사용자',
    })
    expect(USER_STATUS_LABELS).toEqual({
      ACTIVE: '활성',
      PENDING: '승인 대기',
      INACTIVE: '비활성',
      REJECTED: '반려',
    })

    expect(getUserRoleLabel('ADMIN')).toBe('관리자')
    expect(getUserRoleLabel('USER')).toBe('일반 사용자')
    expect(getUserStatusLabel('ACTIVE')).toBe('활성')
    expect(getUserStatusLabel('PENDING')).toBe('승인 대기')
    expect(getUserStatusLabel('INACTIVE')).toBe('비활성')
    expect(getUserStatusLabel('REJECTED')).toBe('반려')

    expect(isAdminRole('ADMIN')).toBe(true)
    expect(isAdminRole('USER')).toBe(false)
    expect(hasAdminAccess({ role: 'ADMIN' })).toBe(true)
    expect(hasAdminAccess({ role: 'USER' })).toBe(false)
    expect(hasAdminAccess(null)).toBe(false)
  })
})
