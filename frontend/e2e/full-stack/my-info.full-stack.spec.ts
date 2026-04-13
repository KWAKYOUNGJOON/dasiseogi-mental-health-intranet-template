import { expect, test, type Page } from '@playwright/test'
import type { AuthUser } from '../../src/features/auth/api/authApi'
import { getUserRoleLabel, getUserStatusLabel } from '../../src/shared/user/userMetadata'

const DEFAULT_PASSWORD = 'Test1234!'
const LOGIN_HEADING = '다시서기 정신건강 평가관리 시스템'
const CLIENT_LIST_PATH_PATTERN = /\/clients$/
const MY_INFO_PATH_PATTERN = /\/my-info$/
const TEST_ACCOUNTS = [
  { loginId: 'admina', password: DEFAULT_PASSWORD, description: '관리자' },
  { loginId: 'usera', password: DEFAULT_PASSWORD, description: '일반 사용자' },
] as const

type ApiEnvelope<T> = {
  success: boolean
  data: T
  message: string | null
  errorCode: string | null
}

function getFieldInput(page: Page, label: string) {
  return page.locator('label.field').filter({ hasText: label }).locator('input').first()
}

async function expectLoginScreen(page: Page) {
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  await expect(page.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible()
}

async function login(page: Page, loginId: string, password: string) {
  await page.goto('/login')
  await expectLoginScreen(page)

  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(CLIENT_LIST_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
}

async function fetchCurrentUser(page: Page) {
  const response = await page.evaluate(async () => {
    const httpResponse = await fetch('/api/v1/auth/me', {
      credentials: 'same-origin',
    })
    const rawText = await httpResponse.text()
    let payload: ApiEnvelope<AuthUser> | null = null

    try {
      payload = rawText ? (JSON.parse(rawText) as ApiEnvelope<AuthUser>) : null
    } catch {
      payload = null
    }

    return {
      ok: httpResponse.ok,
      status: httpResponse.status,
      payload,
      rawText,
    }
  })

  if (!response.ok || !response.payload?.success) {
    const errorMessage =
      response.payload?.message ??
      response.payload?.errorCode ??
      response.rawText.trim() ??
      'Unknown API error'

    throw new Error(`GET /auth/me failed (${response.status}): ${errorMessage}`)
  }

  return response.payload.data
}

async function expectMyInfoCoreFields(page: Page, user: AuthUser) {
  await expect(page.getByRole('heading', { name: '내 정보' })).toBeVisible()
  await expect(getFieldInput(page, '아이디')).toHaveValue(user.loginId)
  await expect(getFieldInput(page, '권한')).toHaveValue(getUserRoleLabel(user.role))
  await expect(getFieldInput(page, '계정 상태')).toHaveValue(getUserStatusLabel(user.status))
  await expect(getFieldInput(page, '이름')).toHaveValue(user.name)
}

test.describe('내 정보 실브라우저 스모크', () => {
  for (const account of TEST_ACCOUNTS) {
    test(`${account.description}가 topbar에서 내 정보 화면으로 이동해 본인 핵심 정보를 확인할 수 있다 @full-stack-smoke`, async ({
      page,
    }) => {
      await login(page, account.loginId, account.password)

      const currentUser = await fetchCurrentUser(page)

      await expect(page.locator('.topbar-user')).toContainText(currentUser.name)

      const myInfoLink = page.locator('.topbar-actions').getByRole('link', { name: '내 정보' })

      await expect(myInfoLink).toBeVisible()
      await myInfoLink.click()

      await expect(page).toHaveURL(MY_INFO_PATH_PATTERN)
      await expectMyInfoCoreFields(page, currentUser)
    })
  }
})
