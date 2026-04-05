import { expect, test, type Page } from '@playwright/test'

const LOGIN_ID = 'usera'
const PASSWORD = 'Test1234!'

async function readVisibleErrors(page: Page) {
  const messages = await page.locator('[role="alert"], .error-text').allInnerTexts()
  return messages.map((message) => message.trim()).filter(Boolean)
}

test('seeded user can log in and reach the main screen', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: '다시서기 정신건강 평가관리 시스템' })).toBeVisible()

  try {
    await page.getByLabel('아이디').fill(LOGIN_ID)
    await page.getByLabel('비밀번호').fill(PASSWORD)
    await page.getByRole('button', { name: '로그인' }).click()

    await expect(page).toHaveURL(/\/clients$/)
    await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
    await expect(page.locator('.topbar-user')).toContainText('사용자A')
    await expect(page.locator('.topbar-user')).toContainText('일반 사용자')
  } catch (error) {
    const visibleErrors = await readVisibleErrors(page)

    console.error(
      [
        '[playwright] 로그인 성공 검증 실패',
        `- currentUrl: ${page.url()}`,
        `- loginId: ${LOGIN_ID}`,
        `- visibleErrors: ${visibleErrors.length > 0 ? visibleErrors.join(' | ') : '없음'}`,
      ].join('\n'),
    )

    throw error
  }
})
