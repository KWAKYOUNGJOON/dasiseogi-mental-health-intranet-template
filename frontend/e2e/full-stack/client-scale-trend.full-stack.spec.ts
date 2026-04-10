import { expect, test, type Page } from '@playwright/test'

const LOGIN_ID = 'usera'
const PASSWORD = 'Test1234!'
const DEFAULT_SCALE_CODE = 'GAD7'
const RECORDED_SCALE_CODE = 'PHQ9'

type ApiEnvelope<T> = {
  success: boolean
  data: T
  message: string | null
  errorCode: string | null
  fieldErrors: Array<{
    field?: string
    message?: string
  }>
}

type AuthUser = {
  id: number
  loginId: string
  name: string
}

type ClientCreateResponse = {
  id: number
  clientNo: string
}

type ClientDetailSummary = {
  latestRecordedScaleCode: string | null
}

type SessionCreateResponse = {
  sessionId: number
  sessionNo: string
  clientId: number
  status: string
  scaleCount: number
  hasAlert: boolean
}

type AssessmentScaleRequest = {
  scaleCode: string
  answers: Array<{
    questionNo: number
    answerValue: string
  }>
}

type ClientFixture = {
  clientId: number
  clientName: string
}

type ScaleListItem = {
  scaleCode: string
  displayOrder: number
  isActive: boolean
  implemented: boolean
}

type ScaleTrendFlowFixture = ClientFixture & {
  emptyScaleCode: string
  newerRecordedSessionId: number
  newerRecordedAssessedAtText: string
}

function createUniqueToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12)
}

function buildAnswers(answerValues: number[]) {
  return answerValues.map((answerValue, index) => ({
    questionNo: index + 1,
    answerValue: String(answerValue),
  }))
}

function getOperatingScaleItems(scaleItems: ScaleListItem[]) {
  return scaleItems
    .filter((item) => item.isActive && item.implemented)
    .sort((left, right) => left.displayOrder - right.displayOrder)
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

async function login(page: Page) {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: '다시서기 정신건강 평가관리 시스템' })).toBeVisible()

  await page.getByLabel('아이디').fill(LOGIN_ID)
  await page.getByLabel('비밀번호').fill(PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/clients$/)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
}

async function createClient(page: Page, namePrefix: string): Promise<ClientFixture> {
  const token = createUniqueToken()
  const clientName = `${namePrefix} ${token}`
  const currentUser = await callApi<AuthUser>(page, '/auth/me')
  const createdClient = await callApi<ClientCreateResponse>(page, '/clients', {
    method: 'POST',
    body: {
      name: clientName,
      gender: 'MALE',
      birthDate: '1990-01-02',
      phone: '010-5555-1212',
      primaryWorkerId: currentUser.id,
    },
  })

  return {
    clientId: createdClient.id,
    clientName,
  }
}

async function createAssessmentSession(
  page: Page,
  input: {
    clientId: number
    sessionStartedAt: string
    sessionCompletedAt: string
    memo: string
    selectedScales: AssessmentScaleRequest[]
  },
) {
  return callApi<SessionCreateResponse>(page, '/assessment-sessions', {
    method: 'POST',
    body: input,
  })
}

async function openClientDetail(page: Page, fixture: ClientFixture) {
  await page.getByPlaceholder('이름 검색').fill(fixture.clientName)
  await page.getByRole('button', { name: '검색' }).click()

  const clientRow = page.locator('tbody tr').filter({ hasText: fixture.clientName }).first()
  await expect(clientRow).toBeVisible()
  await clientRow.getByRole('link', { name: '상세보기' }).click()

  await expect(page).toHaveURL(new RegExp(`/clients/${fixture.clientId}$`))
  await expect(page.getByRole('heading', { name: `${fixture.clientName} 상세` })).toBeVisible()
}

async function createScaleTrendFlowFixture(page: Page): Promise<ScaleTrendFlowFixture> {
  const client = await createClient(page, 'PW 척도추세실사용')

  await createAssessmentSession(page, {
    clientId: client.clientId,
    sessionStartedAt: '2026-04-08T09:00:00',
    sessionCompletedAt: '2026-04-08T09:20:00',
    memo: `Playwright scale trend recorded older ${client.clientName}`,
    selectedScales: [
      {
        scaleCode: RECORDED_SCALE_CODE,
        answers: buildAnswers([0, 0, 0, 0, 0, 0, 0, 0, 1]),
      },
    ],
  })

  const newerRecordedSession = await createAssessmentSession(page, {
    clientId: client.clientId,
    sessionStartedAt: '2026-04-09T10:00:00',
    sessionCompletedAt: '2026-04-09T10:25:00',
    memo: `Playwright scale trend recorded latest ${client.clientName}`,
    selectedScales: [
      {
        scaleCode: RECORDED_SCALE_CODE,
        answers: buildAnswers([1, 1, 1, 1, 1, 1, 1, 1, 1]),
      },
    ],
  })

  await createAssessmentSession(page, {
    clientId: client.clientId,
    sessionStartedAt: '2026-04-10T14:00:00',
    sessionCompletedAt: '2026-04-10T14:15:00',
    memo: `Playwright scale trend default latest ${client.clientName}`,
    selectedScales: [
      {
        scaleCode: DEFAULT_SCALE_CODE,
        answers: buildAnswers([1, 1, 1, 1, 1, 1, 1]),
      },
    ],
  })

  const clientDetail = await callApi<ClientDetailSummary>(page, `/clients/${client.clientId}`)
  const operatingScaleItems = getOperatingScaleItems(await callApi<ScaleListItem[]>(page, '/scales'))
  const emptyScaleCode =
    operatingScaleItems.find((item) => ![DEFAULT_SCALE_CODE, RECORDED_SCALE_CODE].includes(item.scaleCode))?.scaleCode ??
    ''

  expect(clientDetail.latestRecordedScaleCode).toBe(DEFAULT_SCALE_CODE)
  expect(emptyScaleCode).toBeTruthy()

  return {
    ...client,
    emptyScaleCode,
    newerRecordedSessionId: newerRecordedSession.sessionId,
    newerRecordedAssessedAtText: '2026-04-09 10:25',
  }
}

test('척도 추세 최종 실사용 흐름이 대상자 상세에서 세션 상세 이동까지 유지된다', async ({ page }) => {
  await login(page)

  const fixture = await createScaleTrendFlowFixture(page)

  await openClientDetail(page, fixture)

  await expect(page.getByRole('heading', { name: '척도 추세' })).toBeVisible()

  const scaleSelect = page.getByLabel('척도 선택')
  await expect(scaleSelect).toBeVisible()
  await expect(scaleSelect).toHaveValue(DEFAULT_SCALE_CODE)

  await expect(page.getByTestId('client-scale-trend-chart')).toBeVisible()
  await expect(page.getByTestId('client-scale-trend-point')).toHaveCount(1)
  await expect(page.getByText('총 1건')).toBeVisible()

  await scaleSelect.selectOption(RECORDED_SCALE_CODE)
  await expect(scaleSelect).toHaveValue(RECORDED_SCALE_CODE)
  await expect(page.getByTestId('client-scale-trend-chart')).toBeVisible()
  await expect(page.getByTestId('client-scale-trend-line')).toBeVisible()
  await expect(page.getByTestId('client-scale-trend-point')).toHaveCount(2)
  await expect(page.getByText('총 2건')).toBeVisible()

  await scaleSelect.selectOption(fixture.emptyScaleCode)
  await expect(scaleSelect).toHaveValue(fixture.emptyScaleCode)
  await expect(page.getByText('기록 없음')).toBeVisible()
  await expect(page.getByTestId('client-scale-trend-chart')).toHaveCount(0)
  await expect(page.getByTestId('client-scale-trend-point')).toHaveCount(0)

  await scaleSelect.selectOption(RECORDED_SCALE_CODE)
  await expect(scaleSelect).toHaveValue(RECORDED_SCALE_CODE)

  const trendPoints = page.getByTestId('client-scale-trend-point')
  await expect(trendPoints).toHaveCount(2)

  const targetPoint = trendPoints.nth(1)

  await targetPoint.focus()
  await expect(targetPoint).toBeFocused()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await expect(page.getByRole('tooltip')).toContainText(fixture.newerRecordedAssessedAtText)

  await targetPoint.blur()
  await expect(page.getByRole('tooltip')).toHaveCount(0)

  await targetPoint.hover()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await expect(page.getByRole('tooltip')).toContainText(fixture.newerRecordedAssessedAtText)

  await targetPoint.click()

  await expect(page).toHaveURL(
    new RegExp(`/assessments/sessions/${fixture.newerRecordedSessionId}\\?highlightScaleCode=${RECORDED_SCALE_CODE}$`),
  )
  await expect(page.getByRole('heading', { name: '세션 상세' })).toBeVisible()
  await expect(page.getByText('현재 강조된 척도')).toBeVisible()
  await expect(page.getByTestId(`session-scale-${RECORDED_SCALE_CODE}`)).toHaveAttribute('data-highlighted', 'true')
})
