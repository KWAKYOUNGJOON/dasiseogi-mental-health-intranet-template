import { vi } from 'vitest'

;(globalThis as typeof globalThis & { __TEST_APP_METADATA__?: unknown }).__TEST_APP_METADATA__ = {
  metadata: {
    organizationName: '다시서기 정신건강 평가관리 시스템',
    positionNames: ['팀장', '대리', '실무자'],
  },
  organizationName: '다시서기 정신건강 평가관리 시스템',
  positionNames: ['팀장', '대리', '실무자'],
  status: 'ready',
  refresh: vi.fn(),
}
