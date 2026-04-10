import { expect, test, type Page } from '@playwright/test'

const LOGIN_ID = 'usera'
const PASSWORD = 'Test1234!'

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

type TrendFixture = ClientFixture & {
  olderSessionId: number
  newerSessionId: number
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
  await expect(page.getByRole('heading', { name: '척도 추세' })).toBeVisible()
}

async function createClientWithTrendSessions(page: Page): Promise<TrendFixture> {
  const client = await createClient(page, 'PW 척도추세')
  const olderSession = await callApi<SessionCreateResponse>(page, '/assessment-sessions', {
    method: 'POST',
    body: {
      clientId: client.clientId,
      sessionStartedAt: '2026-04-08T09:00:00',
      sessionCompletedAt: '2026-04-08T09:20:00',
      memo: `Playwright scale trend older ${client.clientName}`,
      selectedScales: [
        {
          scaleCode: 'PHQ9',
          answers: buildAnswers([0, 0, 0, 0, 0, 0, 0, 0, 1]),
        },
      ],
    },
  })
  const newerSession = await callApi<SessionCreateResponse>(page, '/assessment-sessions', {
    method: 'POST',
    body: {
      clientId: client.clientId,
      sessionStartedAt: '2026-04-09T10:00:00',
      sessionCompletedAt: '2026-04-09T10:25:00',
      memo: `Playwright scale trend latest ${client.clientName}`,
      selectedScales: [
        {
          scaleCode: 'PHQ9',
          answers: buildAnswers([1, 1, 1, 1, 1, 1, 1, 1, 1]),
        },
      ],
    },
  })

  return {
    ...client,
    olderSessionId: olderSession.sessionId,
    newerSessionId: newerSession.sessionId,
  }
}

async function createClientWithLatestRecordedOperatingScale(page: Page): Promise<ClientFixture> {
  const client = await createClient(page, 'PW 최신척도기본값')

  await createAssessmentSession(page, {
    clientId: client.clientId,
    sessionStartedAt: '2026-04-07T09:00:00',
    sessionCompletedAt: '2026-04-07T09:20:00',
    memo: `Playwright latest scale older ${client.clientName}`,
    selectedScales: [
      {
        scaleCode: 'PHQ9',
        answers: buildAnswers([1, 1, 1, 1, 0, 0, 0, 0, 0]),
      },
    ],
  })

  await createAssessmentSession(page, {
    clientId: client.clientId,
    sessionStartedAt: '2026-04-09T14:00:00',
    sessionCompletedAt: '2026-04-09T14:15:00',
    memo: `Playwright latest scale newer ${client.clientName}`,
    selectedScales: [
      {
        scaleCode: 'GAD7',
        answers: buildAnswers([1, 1, 1, 1, 1, 1, 1]),
      },
    ],
  })

  return client
}

test('척도 추세 사용 흐름이 대상자 상세에서 세션 강조까지 이어진다', async ({ page }) => {
  await login(page)

  const trendFixture = await createClientWithTrendSessions(page)

  await openClientDetail(page, trendFixture)

  const scaleSelect = page.getByLabel('척도 선택')
  await expect(scaleSelect).toBeVisible()
  await expect(scaleSelect).toHaveValue('PHQ9')

  await expect(page.getByTestId('client-scale-trend-chart')).toBeVisible()
  await expect(page.getByTestId('client-scale-trend-line')).toBeVisible()
  await expect(page.getByText('총 2건')).toBeVisible()

  const trendPoints = page.getByTestId('client-scale-trend-point')
  await expect(trendPoints).toHaveCount(2)
  await expect(trendPoints.nth(1)).toBeVisible()

  await trendPoints.nth(1).click()

  await expect(page).toHaveURL(
    new RegExp(`/assessments/sessions/${trendFixture.newerSessionId}\\?highlightScaleCode=PHQ9$`),
  )
  await expect(page.getByRole('heading', { name: '세션 상세' })).toBeVisible()
  await expect(page.getByText('현재 강조된 척도')).toBeVisible()
  await expect(page.getByTestId('session-scale-PHQ9')).toHaveAttribute('data-highlighted', 'true')
})

test('운영 중 척도 기록이 없는 대상자는 척도 추세에 기록 없음이 표시된다', async ({ page }) => {
  await login(page)

  const clientFixture = await createClient(page, 'PW 척도추세빈상태')

  await openClientDetail(page, clientFixture)

  await expect(page.getByLabel('척도 선택')).toHaveValue('PHQ9')
  await expect(page.getByText('기록 없음')).toBeVisible()
  await expect(page.getByTestId('client-scale-trend-chart')).toHaveCount(0)
  await expect(page.getByTestId('client-scale-trend-point')).toHaveCount(0)
})

test('최신 기록 운영 척도가 척도 추세의 기본 선택값으로 표시된다', async ({ page }) => {
  await login(page)

  const clientFixture = await createClientWithLatestRecordedOperatingScale(page)

  await openClientDetail(page, clientFixture)

  const scaleSelect = page.getByLabel('척도 선택')
  await expect(scaleSelect).toHaveValue('GAD7')
  await expect(page.getByTestId('client-scale-trend-chart')).toBeVisible()
  await expect(page.getByTestId('client-scale-trend-point')).toHaveCount(1)
  await expect(page.getByText('총 1건')).toBeVisible()
})

test('차트 point를 키보드 Space로 선택하면 세션 상세로 이동하며 강조 척도를 유지한다', async ({ page }) => {
  await login(page)

  const trendFixture = await createClientWithTrendSessions(page)

  await openClientDetail(page, trendFixture)

  const trendPoints = page.getByTestId('client-scale-trend-point')
  await expect(trendPoints).toHaveCount(2)
  await trendPoints.nth(1).focus()
  await expect(trendPoints.nth(1)).toBeFocused()

  await page.keyboard.press('Space')

  await expect(page).toHaveURL(
    new RegExp(`/assessments/sessions/${trendFixture.newerSessionId}\\?highlightScaleCode=PHQ9$`),
  )
  await expect(page.getByRole('heading', { name: '세션 상세' })).toBeVisible()
  await expect(page.getByText('현재 강조된 척도')).toBeVisible()
  await expect(page.getByTestId('session-scale-PHQ9')).toHaveAttribute('data-highlighted', 'true')
})
