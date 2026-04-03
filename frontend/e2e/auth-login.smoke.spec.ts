import { expect, test } from '@playwright/test'

const authUser = {
  id: 7,
  loginId: 'admin01',
  name: '관리자 테스트',
  phone: '010-1234-5678',
  positionName: '상담사',
  teamName: '통합지원팀',
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
}

function ok<T>(data: T) {
  return {
    success: true,
    data,
    message: null,
    errorCode: null,
    fieldErrors: [],
  }
}

test('로그인 폼은 빈 값 검증 메시지를 표시한다', async ({ page }) => {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        data: null,
        message: '인증 정보가 없습니다.',
        errorCode: 'UNAUTHORIZED',
        fieldErrors: [],
      }),
    })
  })

  await page.goto('/login')

  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page.getByText('입력값을 다시 확인해주세요.')).toBeVisible()
  await expect(page.getByText('아이디를 입력해주세요.')).toBeVisible()
  await expect(page.getByText('비밀번호를 입력해주세요.')).toBeVisible()
})

test('로그인 후 대상자 목록 화면으로 이동한다', async ({ page }) => {
  let authenticated = false

  await page.route('**/api/v1/auth/me', async (route) => {
    if (authenticated) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ok(authUser)),
      })
      return
    }

    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        data: null,
        message: '인증 정보가 없습니다.',
        errorCode: 'UNAUTHORIZED',
        fieldErrors: [],
      }),
    })
  })

  await page.route('**/api/v1/auth/login', async (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON()).toEqual({
      loginId: 'admin01',
      password: 'password123!',
    })

    authenticated = true

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        ok({
          user: authUser,
          sessionTimeoutMinutes: 120,
        }),
      ),
    })
  })

  await page.route('**/api/v1/clients**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        ok({
          items: [
            {
              id: 101,
              clientNo: 'CL-2026-0001',
              name: '김테스트',
              birthDate: '1990-01-02',
              gender: 'MALE',
              primaryWorkerName: '관리자 테스트',
              latestSessionDate: '2026-04-03',
              status: 'ACTIVE',
            },
          ],
          page: 1,
          size: 20,
          totalItems: 1,
          totalPages: 1,
        }),
      ),
    })
  })

  await page.goto('/')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: '다시서기 정신건강 평가관리 시스템' })).toBeVisible()

  await page.getByLabel('아이디').fill('admin01')
  await page.getByLabel('비밀번호').fill('password123!')
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/clients$/)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
  await expect(page.locator('.topbar-user').getByText('관리자 테스트')).toBeVisible()
  await expect(page.getByRole('cell', { name: '김테스트' })).toBeVisible()
  await expect(page.getByRole('link', { name: '사용자 관리' })).toBeVisible()
})
