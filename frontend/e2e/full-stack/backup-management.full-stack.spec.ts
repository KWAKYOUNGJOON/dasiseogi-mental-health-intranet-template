import { expect, test, type Locator, type Page } from '@playwright/test'

const ADMIN_LOGIN_ID = 'admina'
const USER_LOGIN_ID = 'usera'
const DEFAULT_PASSWORD = 'Test1234!'
const LOGIN_HEADING = '다시서기 정신건강 평가관리 시스템'

function createUniqueToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12)
}

function extractBackupFileNameFromNotice(text: string) {
  const match = text.match(/(backup-[A-Za-z0-9._-]+\.(?:zip|sql))/i)

  if (!match) {
    throw new Error(`Could not extract a backup file name from notice text: ${text}`)
  }

  return match[1]
}

async function expectLoginScreen(page: Page) {
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  await expect(page.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible()
}

async function login(page: Page, loginId: string, password: string, expectedName: string) {
  await page.goto('/login')
  await expectLoginScreen(page)

  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/clients$/)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
  await expect(page.locator('.topbar-user')).toContainText(expectedName)
}

function getBackupCountText(page: Page) {
  return page.getByText(/^총 \d+건$/).first()
}

async function readBackupCount(page: Page) {
  const text = (await getBackupCountText(page).textContent())?.trim() ?? ''
  const match = text.match(/^총 (\d+)건$/)

  if (!match) {
    throw new Error(`Could not parse backup count text: ${text}`)
  }

  return Number(match[1])
}

function getBackupRowByFileName(page: Page, fileName: string) {
  return page.locator('tbody tr').filter({ hasText: fileName }).first()
}

async function expectBackupMetadataRow(
  row: Locator,
  input: {
    fileName: string
    executedByName: string
  },
) {
  await expect(row).toBeVisible()

  const cells = (await row.getByRole('cell').allTextContents()).map((value) => value.trim())

  expect(cells).toHaveLength(10)
  expect(cells[0]).toMatch(/^\d+$/)
  expect(cells[1]).toBe('MANUAL')
  expect(cells[2]).toBe('SUCCESS')
  expect(cells[3]).toBe(input.fileName)
  expect(cells[4]).toContain(input.fileName)
  expect(cells[5]).toMatch(/^\d+(?:\.\d)?\s(?:B|KB|MB)$/)
  expect(cells[6]).not.toBe('-')
  expect(cells[7]).not.toBe('-')
  expect(cells[8]).toBe(input.executedByName)
  expect(cells[9]).toBe('-')
}

test.describe('실브라우저 백업 관리', () => {
  test('관리자가 백업을 생성하면 목록과 현재 UI의 다운로드 노출 상태가 반영된다', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const reason = `Playwright backup management ${token}`

    await login(page, ADMIN_LOGIN_ID, DEFAULT_PASSWORD, '관리자A')

    await page.getByRole('link', { name: '백업 관리' }).click()

    await expect(page).toHaveURL(/\/admin\/backups$/)
    await expect(page.getByRole('heading', { name: '백업 관리' })).toBeVisible()
    await expect(page.getByRole('button', { name: '수동 백업 실행' })).toBeVisible()
    const reloadButton = page.getByRole('button', { name: '재조회' }).first()

    await expect(reloadButton).toBeVisible()
    await expect(page.getByText('백업 파일 다운로드나 삭제는 이번 화면 범위에 포함하지 않습니다.')).toBeVisible()

    const baselineCount = await readBackupCount(page)

    await page.getByRole('button', { name: '수동 백업 실행' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: '수동 백업 실행 확인' })).toBeVisible()
    await dialog.getByLabel('실행 사유').fill(reason)
    await dialog.getByRole('button', { name: '백업 실행' }).click()

    const notice = page.getByRole('status')
    await expect(notice).toContainText('수동 백업을 실행했습니다.')

    const noticeText = (await notice.textContent())?.trim() ?? ''
    const fileName = extractBackupFileNameFromNotice(noticeText)
    const createdRow = getBackupRowByFileName(page, fileName)

    await expect.poll(async () => readBackupCount(page)).toBe(baselineCount + 1)
    await expect(createdRow).toBeVisible()
    await expectBackupMetadataRow(createdRow, {
      fileName,
      executedByName: '관리자A',
    })

    await reloadButton.click()

    await expect(getBackupCountText(page)).toHaveText(`총 ${baselineCount + 1}건`)
    await expect(createdRow).toBeVisible()
    await expectBackupMetadataRow(createdRow, {
      fileName,
      executedByName: '관리자A',
    })

    await expect(page.getByRole('button', { name: /다운로드/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /다운로드/ })).toHaveCount(0)
    await expect(createdRow.getByRole('link')).toHaveCount(0)
  })

  test('일반 사용자는 백업 관리 화면에 접근할 수 없다', async ({ page }) => {
    await login(page, USER_LOGIN_ID, DEFAULT_PASSWORD, '사용자A')

    await expect(page.getByRole('link', { name: '백업 관리' })).toHaveCount(0)

    await page.goto('/admin/backups')

    await expect(page).toHaveURL(/\/clients$/)
    await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
  })
})
