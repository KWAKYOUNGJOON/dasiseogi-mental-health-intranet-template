import { expect, test } from '@playwright/test'

test('seeded admin can log in and reach admin user management', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: '다시서기 정신건강 평가관리 시스템' })).toBeVisible()

  await page.getByLabel('아이디').fill('admina')
  await page.getByLabel('비밀번호').fill('Test1234!')
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/clients$/)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
  await expect(page.locator('.topbar-user').getByText('관리자A')).toBeVisible()
  await expect(page.getByRole('cell', { name: '김대상' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '박대상' })).toBeVisible()
  await expect(page.getByRole('link', { name: '사용자 관리' })).toBeVisible()

  await page.getByRole('link', { name: '사용자 관리' }).click()

  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'admina' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'pendinguser' })).toBeVisible()
  await expect(page.getByText(/총 \d+명/)).toBeVisible()
})
