import { expect, test, type Locator, type Page } from '@playwright/test'

const ADMIN_LOGIN_ID = 'admina'
const DEFAULT_PASSWORD = 'Test1234!'
const CLIENT_LIST_PATH_PATTERN = /\/clients$/

function createUniqueToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12)
}

function getClientIdFromUrl(url: string) {
  const matchedClientId = new URL(url).pathname.match(/\/clients\/(\d+)$/)?.[1]
  const clientId = Number(matchedClientId)

  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new Error(`Could not parse a client id from URL: ${url}`)
  }

  return clientId
}

function getClientDetailField(page: Page, label: string) {
  return page.locator('.field').filter({ hasText: label }).locator('strong').first()
}

async function expectLoginScreen(page: Page) {
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  await expect(page.getByRole('heading', { name: '다시서기 정신건강 평가관리 시스템' })).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible()
}

async function login(page: Page, loginId = ADMIN_LOGIN_ID, password = DEFAULT_PASSWORD, expectedName = '관리자A') {
  await page.goto('/login')
  await expectLoginScreen(page)

  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(CLIENT_LIST_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
  await expect(page.locator('.topbar-user')).toContainText(expectedName)
}

async function createClientThroughUi(
  page: Page,
  input: {
    name: string
    gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN'
    birthDate: string
    phone: string
  },
) {
  await page.goto('/clients/new')
  await expect(page.getByRole('heading', { name: '대상자 등록' })).toBeVisible()

  await page.getByLabel('이름').fill(input.name)
  await page.getByLabel('성별').selectOption(input.gender)
  await page.getByLabel('생년월일').fill(input.birthDate)
  await page.getByLabel('연락처').fill(input.phone)
  await page.getByRole('button', { name: '중복 확인' }).click()
  await expect(page.getByText('중복 후보가 없습니다.')).toBeVisible()

  await page.getByRole('button', { name: '저장' }).click()

  await expect(page).toHaveURL(/\/clients\/\d+$/)
  await expect(page.getByRole('heading', { name: `${input.name} 상세` })).toBeVisible()

  return getClientIdFromUrl(page.url())
}

async function setCheckboxState(locator: Locator, checked: boolean) {
  if ((await locator.isChecked()) === checked) {
    return
  }

  await locator.click()
}

async function searchClients(page: Page, name: string, includeMisregistered: boolean) {
  await page.goto('/clients')
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()

  await page.getByPlaceholder('이름 검색').fill(name)
  await setCheckboxState(page.getByLabel('오등록 포함'), includeMisregistered)
  await page.getByRole('button', { name: '검색' }).click()
}

async function markCurrentClientMisregistered(page: Page, reason: string) {
  await page.getByRole('button', { name: '오등록 처리' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog.getByRole('heading', { name: '대상자 오등록 처리' })).toBeVisible()
  await expect(dialog.getByText('물리 삭제하지 않고 대상자 상태만 MISREGISTERED로 변경합니다.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: '오등록 처리' })).toBeDisabled()

  await dialog.getByRole('textbox').fill(reason)
  await expect(dialog.getByRole('button', { name: '오등록 처리' })).toBeEnabled()
  await dialog.getByRole('button', { name: '오등록 처리' }).click()

  await expect(page.getByText('오등록 처리되었습니다.')).toBeVisible()
}

test.describe('실브라우저 대상자 상세/수정/오등록 회귀', () => {
  test('관리자는 대상자 상세에서 수정 후 오등록 처리와 목록 재조회를 실제 UI로 검증한다', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const createdName = `PW 상세 수정 ${token}`
    const updatedName = `PW 상세 수정 완료 ${token}`
    const createdPhone = '010-1234-5678'
    const updatedPhone = '010-9988-7766'
    const birthDate = '19920413'
    const misregisteredReason = `Playwright 상세 오등록 사유 ${token}`

    await login(page)

    const clientId = await createClientThroughUi(page, {
      name: createdName,
      gender: 'FEMALE',
      birthDate,
      phone: createdPhone,
    })

    await expect(getClientDetailField(page, '사례번호')).toHaveText(/CL-\d+/)
    await expect(getClientDetailField(page, '담당자')).toHaveText('관리자A')
    await expect(getClientDetailField(page, '생년월일')).toHaveText('1992-04-13')
    await expect(getClientDetailField(page, '연락처')).toHaveText(createdPhone)
    await expect(getClientDetailField(page, '상태')).toHaveText('활성')

    await page.getByRole('link', { name: '정보 수정' }).click()

    await expect(page).toHaveURL(new RegExp(`/clients/${clientId}/edit$`))
    await expect(page.getByRole('heading', { name: '대상자 정보 수정' })).toBeVisible()
    await expect(page.getByLabel('이름')).toHaveValue(createdName)
    await expect(page.getByLabel('연락처')).toHaveValue(createdPhone)
    await expect(page.getByLabel('담당자')).toHaveValue(/\d+/)

    await page.getByLabel('이름').fill(updatedName)
    await page.getByLabel('연락처').fill(updatedPhone)
    await page.getByLabel('담당자').selectOption({ label: '사용자B' })
    await page.getByRole('button', { name: '저장' }).click()

    await expect(page).toHaveURL(new RegExp(`/clients/${clientId}$`))
    await expect(page.getByRole('heading', { name: `${updatedName} 상세` })).toBeVisible()
    await expect(getClientDetailField(page, '담당자')).toHaveText('사용자B')
    await expect(getClientDetailField(page, '생년월일')).toHaveText('1992-04-13')
    await expect(getClientDetailField(page, '연락처')).toHaveText(updatedPhone)
    await expect(getClientDetailField(page, '상태')).toHaveText('활성')

    await markCurrentClientMisregistered(page, misregisteredReason)

    await expect(getClientDetailField(page, '상태')).toHaveText('오등록')
    await expect(getClientDetailField(page, '처리자')).toHaveText('관리자A')
    await expect(getClientDetailField(page, '사유')).toHaveText(misregisteredReason)

    await searchClients(page, updatedName, false)
    await expect(page.getByText('검색 조건에 맞는 대상자가 없습니다.')).toBeVisible()

    await searchClients(page, updatedName, true)

    const row = page.locator('tbody tr').filter({ hasText: updatedName }).first()

    await expect(row).toContainText(updatedName)
    await expect(row).toContainText('사용자B')
    await expect(row).toContainText('오등록')
    await expect(row.getByRole('link', { name: '상세보기' })).toHaveAttribute('href', new RegExp(`/clients/${clientId}$`))
  })
})
