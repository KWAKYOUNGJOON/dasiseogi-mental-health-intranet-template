import { expect, test, type Page } from '@playwright/test'

const ADMIN_LOGIN_ID = 'admina'
const DEFAULT_PASSWORD = 'Test1234!'
const ADMIN_NAME = '관리자A'
const LOGIN_HEADING = '다시서기 정신건강 평가관리 시스템'
const CLIENT_LIST_PATH_PATTERN = /\/clients$/
const CLIENT_LIST_ERROR_MESSAGE = '대상자 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'

type ApiEnvelope<T> = {
  success: boolean
  data: T
  message: string | null
  errorCode: string | null
  fieldErrors: Array<{
    field?: string
    reason?: string
    message?: string
  }>
}

type AuthUser = {
  id: number
  name: string
}

type ClientCreateResponse = {
  id: number
  clientNo: string
}

type DuplicateCandidate = {
  id: number
  clientNo: string
  name: string
  birthDate: string
  primaryWorkerName: string
  status: string
}

type DuplicateCheckResponse = {
  isDuplicate: boolean
  candidates: DuplicateCandidate[]
}

function createUniqueToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12)
}

function getClientIdFromUrl(url: string) {
  const clientId = Number(new URL(url).pathname.split('/').pop())

  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new Error(`Could not parse a client id from URL: ${url}`)
  }

  return clientId
}

function buildClientListEnvelope(items: Array<{
  id: number
  clientNo: string
  name: string
  birthDate: string
  gender: string
  primaryWorkerName: string
  latestSessionDate: string | null
  status: string
}> = []): ApiEnvelope<{
  items: Array<{
    id: number
    clientNo: string
    name: string
    birthDate: string
    gender: string
    primaryWorkerName: string
    latestSessionDate: string | null
    status: string
  }>
  page: number
  size: number
  totalItems: number
  totalPages: number
}> {
  return {
    success: true,
    data: {
      items,
      page: 1,
      size: 20,
      totalItems: items.length,
      totalPages: items.length === 0 ? 0 : 1,
    },
    message: null,
    errorCode: null,
    fieldErrors: [],
  }
}

function isClientListPath(requestUrl: string) {
  return new URL(requestUrl).pathname.endsWith('/api/v1/clients')
}

function isDefaultClientListRequest(requestUrl: string) {
  const url = new URL(requestUrl)

  return (
    isClientListPath(requestUrl) &&
    (url.searchParams.get('name') ?? '') === '' &&
    (url.searchParams.get('birthDate') ?? '') === '' &&
    ((url.searchParams.get('includeMisregistered') ?? '') === '' ||
      (url.searchParams.get('includeMisregistered') ?? '') === 'false') &&
    url.searchParams.get('page') === '1' &&
    url.searchParams.get('size') === '20'
  )
}

async function expectLoginScreen(page: Page) {
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  await expect(page.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible()
}

async function login(page: Page, loginId = ADMIN_LOGIN_ID, password = DEFAULT_PASSWORD, expectedName = ADMIN_NAME) {
  await page.goto('/login')
  await expectLoginScreen(page)

  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(CLIENT_LIST_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
  await expect(page.locator('.topbar-user')).toContainText(expectedName)
}

async function callApi<T>(
  page: Page,
  path: string,
  init?: {
    method?: 'GET' | 'POST'
    body?: unknown
  },
) {
  const response = await page.evaluate(
    async ({ path: requestPath, init: requestInit }) => {
      const httpResponse = await fetch(`/api/v1${requestPath}`, {
        method: requestInit?.method ?? 'GET',
        headers: requestInit?.body ? { 'Content-Type': 'application/json' } : undefined,
        body: requestInit?.body ? JSON.stringify(requestInit.body) : undefined,
        credentials: 'same-origin',
      })
      const rawText = await httpResponse.text()
      let payload: ApiEnvelope<unknown> | null = null

      try {
        payload = rawText ? (JSON.parse(rawText) as ApiEnvelope<unknown>) : null
      } catch {
        payload = null
      }

      return {
        ok: httpResponse.ok,
        status: httpResponse.status,
        payload,
        rawText,
      }
    },
    { path, init },
  )

  if (!response.ok || !response.payload?.success) {
    const errorMessage =
      response.payload?.message ??
      response.payload?.errorCode ??
      response.rawText.trim() ??
      'Unknown API error'

    throw new Error(`${init?.method ?? 'GET'} ${path} failed (${response.status}): ${errorMessage}`)
  }

  return response.payload.data as T
}

async function createClientFixture(
  page: Page,
  input: {
    name: string
    birthDate: string
    gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN'
    phone?: string
  },
) {
  const currentUser = await callApi<AuthUser>(page, '/auth/me')
  const createdClient = await callApi<ClientCreateResponse>(page, '/clients', {
    method: 'POST',
    body: {
      name: input.name,
      gender: input.gender ?? 'MALE',
      birthDate: input.birthDate,
      phone: input.phone ?? '010-5555-1212',
      primaryWorkerId: currentUser.id,
    },
  })

  return createdClient
}

async function markClientMisregistered(page: Page, clientId: number, reason: string) {
  await callApi(page, `/clients/${clientId}/mark-misregistered`, {
    method: 'POST',
    body: { reason },
  })
}

async function fillCreateForm(
  page: Page,
  input: {
    name: string
    birthDate: string
    phone: string
    gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN'
  },
) {
  await page.getByLabel('이름').fill(input.name)
  await page.getByLabel('성별').selectOption(input.gender ?? 'MALE')
  await page.getByLabel('생년월일').fill(input.birthDate)
  await page.getByLabel('연락처').fill(input.phone)
}

test.describe('실브라우저 대상자 목록/등록 회귀', () => {
  test('관리자는 대상자 목록 진입과 상세 검색, 상세 링크 이동을 실제 UI로 검증한다', async ({ page }) => {
    await login(page)

    await expect(page.locator('tbody tr').first()).toBeVisible()
    await expect(page.getByText(/\d+건 \/ \d+페이지/)).toBeVisible()

    await page.getByPlaceholder('이름 검색').fill('김대상')
    await page.getByRole('button', { name: '검색' }).click()

    const nameSearchRow = page.locator('tbody tr').filter({ hasText: '김대상' }).first()
    const detailLink = nameSearchRow.getByRole('link', { name: '상세보기' })

    await expect(nameSearchRow).toContainText('1982-07-13')
    await expect(detailLink).toHaveAttribute('href', /\/clients\/\d+$/)
    await detailLink.click()

    await expect(page).toHaveURL(/\/clients\/\d+$/)
    await expect(page.getByRole('heading', { name: '김대상 상세' })).toBeVisible()

    await page.goto('/clients')
    await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()

    const birthDateInput = page.getByLabel('생년월일')

    await birthDateInput.fill('19820713')
    await expect(birthDateInput).toHaveValue('1982-07-13')
    await page.getByRole('button', { name: '검색' }).click()

    const birthDateSearchRow = page.locator('tbody tr').filter({ hasText: '김대상' }).first()
    await expect(birthDateSearchRow).toContainText('1982-07-13')
  })

  test('관리자는 대상자 목록의 기본 빈 상태를 실제 UI로 본다', async ({ page }) => {
    await page.route('**/api/v1/clients**', async (route) => {
      if (route.request().method() === 'GET' && isDefaultClientListRequest(route.request().url())) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildClientListEnvelope()),
        })
        return
      }

      await route.continue()
    })

    await login(page)

    await expect(page.getByText('등록된 대상자가 없습니다.')).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('관리자는 검색 빈 상태와 조회 실패 후 다시 시도 회복을 실제 UI로 검증한다', async ({ page }) => {
    const token = createUniqueToken()
    const emptyKeyword = `PW없는대상자${token}`
    const retryKeyword = `PW재시도대상자${token}`
    let failedOnce = false

    await login(page)

    await page.getByPlaceholder('이름 검색').fill(emptyKeyword)
    await page.getByRole('button', { name: '검색' }).click()

    await expect(page.getByText('검색 조건에 맞는 대상자가 없습니다.')).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)

    await page.route('**/api/v1/clients**', async (route) => {
      if (route.request().method() !== 'GET' || !isClientListPath(route.request().url())) {
        await route.continue()
        return
      }

      const url = new URL(route.request().url())

      if ((url.searchParams.get('name') ?? '') === retryKeyword && !failedOnce) {
        failedOnce = true
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            data: null,
            message: 'forced failure for retry coverage',
            errorCode: 'PLAYWRIGHT_FORCED_FAILURE',
            fieldErrors: [],
          }),
        })
        return
      }

      await route.continue()
    })

    await page.getByPlaceholder('이름 검색').fill(retryKeyword)
    await page.getByRole('button', { name: '검색' }).click()

    await expect(page.getByRole('alert')).toContainText(CLIENT_LIST_ERROR_MESSAGE)
    await expect(page.getByPlaceholder('이름 검색')).toHaveValue(retryKeyword)
    await page.getByRole('button', { name: '다시 시도' }).click()

    await expect(page.getByText('검색 조건에 맞는 대상자가 없습니다.')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('관리자는 대상자 등록에서 중복 후보와 중복 제출 방어를 실제 UI로 검증한다', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const duplicateName = `PW 중복대상 ${token}`
    const duplicateBirthDate = '1990-01-02'
    const uniqueClientName = `PW 저장대상 ${token}`
    const uniqueClientBirthDate = '1991-02-03'
    const cleanupClientIds: number[] = []
    let createdClientId: number | null = null

    await login(page)

    try {
      const misregisteredCandidate = await createClientFixture(page, {
        name: duplicateName,
        birthDate: duplicateBirthDate,
        gender: 'FEMALE',
        phone: '010-1111-2222',
      })

      await markClientMisregistered(page, misregisteredCandidate.id, `Playwright 중복 후보 오등록 ${token}`)

      const activeCandidate = await createClientFixture(page, {
        name: duplicateName,
        birthDate: duplicateBirthDate,
        gender: 'MALE',
        phone: '010-2222-3333',
      })

      cleanupClientIds.push(activeCandidate.id)

      await page.goto('/clients/new')
      await expect(page.getByRole('heading', { name: '대상자 등록' })).toBeVisible()

      await fillCreateForm(page, {
        name: duplicateName,
        birthDate: duplicateBirthDate,
        phone: '010-4444-5555',
        gender: 'MALE',
      })
      await page.getByRole('button', { name: '중복 확인' }).click()

      await expect(page.getByText('동일 이름/생년월일 대상자가 이미 있습니다. 계속 등록할 수 있습니다.')).toBeVisible()

      const duplicateTable = page.getByRole('table', { name: '중복 후보 목록' })

      await expect(duplicateTable).toContainText(misregisteredCandidate.clientNo)
      await expect(duplicateTable).toContainText(activeCandidate.clientNo)
      await expect(duplicateTable).toContainText('오등록')
      await expect(duplicateTable).toContainText('활성')

      await fillCreateForm(page, {
        name: uniqueClientName,
        birthDate: uniqueClientBirthDate,
        phone: '010-6666-7777',
        gender: 'FEMALE',
      })
      await page.getByRole('button', { name: '중복 확인' }).click()

      await expect(page.getByText('중복 후보가 없습니다.')).toBeVisible()
      await expect(page.getByRole('table', { name: '중복 후보 목록' })).toHaveCount(0)

      let createClientRequestCount = 0

      await page.route('**/api/v1/clients**', async (route) => {
        if (route.request().method() === 'POST' && isClientListPath(route.request().url())) {
          createClientRequestCount += 1
          await new Promise((resolve) => {
            setTimeout(resolve, 300)
          })
          await route.continue()
          return
        }

        await route.continue()
      })

      await page.getByRole('button', { name: '저장' }).dblclick()

      await expect(page).toHaveURL(/\/clients\/\d+$/)
      await expect(page.getByRole('heading', { name: `${uniqueClientName} 상세` })).toBeVisible()
      await expect.poll(() => createClientRequestCount).toBe(1)

      createdClientId = getClientIdFromUrl(page.url())
      cleanupClientIds.push(createdClientId)

      const duplicateCheckAfterCreate = await callApi<DuplicateCheckResponse>(page, '/clients/duplicate-check', {
        method: 'POST',
        body: {
          name: uniqueClientName,
          birthDate: uniqueClientBirthDate,
        },
      })

      expect(duplicateCheckAfterCreate.candidates).toHaveLength(1)
      expect(duplicateCheckAfterCreate.candidates[0]?.id).toBe(createdClientId)
    } finally {
      for (const clientId of cleanupClientIds) {
        try {
          await markClientMisregistered(page, clientId, `Playwright clients spec cleanup ${token}`)
        } catch {
          // Cleanup is best-effort because the test already validated the user-facing flow.
        }
      }
    }
  })
})
