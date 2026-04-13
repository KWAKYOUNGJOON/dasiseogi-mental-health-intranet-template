import { expect, test, type Locator, type Page } from '@playwright/test'

const ADMIN_LOGIN_ID = 'admina'
const DEFAULT_PASSWORD = 'Test1234!'
const CLIENT_LIST_PATH_PATTERN = /\/clients$/

function createUniqueToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12)
}

function getSessionIdFromUrl(url: string) {
  const matchedSessionId = new URL(url).pathname.match(/\/assessments\/sessions\/(\d+)$/)?.[1]
  const sessionId = Number(matchedSessionId)

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new Error(`Could not parse a session id from URL: ${url}`)
  }

  return sessionId
}

function parseCount(text: string | null | undefined, context: string) {
  const parsedValue = Number(text?.trim())

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Could not parse a numeric count for ${context}: ${text}`)
  }

  return parsedValue
}

function getSessionDetailField(page: Page, label: string) {
  return page.locator('.card.grid-2 .field').filter({ hasText: label }).locator('strong').first()
}

function getStatisticsSection(page: Page, heading: string) {
  return page.locator('.card.stack').filter({ has: page.getByRole('heading', { name: heading }) }).first()
}

async function expectLoginScreen(page: Page) {
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  await expect(page.getByRole('heading', { name: '다시서기 정신건강 평가관리 시스템' })).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible()
}

async function login(page: Page, loginId: string, password: string, expectedName: string) {
  await page.goto('/login')
  await expectLoginScreen(page)

  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(CLIENT_LIST_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
  await expect(page.locator('.topbar-user')).toContainText(expectedName)
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

async function openClientDetailFromList(page: Page, clientName: string) {
  const row = page.locator('tbody tr').filter({ hasText: clientName }).first()

  await expect(row).toContainText(clientName)
  await row.getByRole('link', { name: '상세보기' }).click()
  await expect(page.getByRole('heading', { name: `${clientName} 상세` })).toBeVisible()
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
}

async function answerQuestion(page: Page, questionIndex: number, optionIndex: number) {
  const question = page.locator('fieldset.assessment-question-card').nth(questionIndex)

  await question.locator('label.assessment-option').nth(optionIndex).click()
}

async function createPhq9SessionThroughUi(
  page: Page,
  input: {
    clientName: string
    memo: string
  },
) {
  await searchClients(page, input.clientName, false)
  await openClientDetailFromList(page, input.clientName)

  await page.getByRole('link', { name: '검사 시작' }).click()

  await expect(page).toHaveURL(/\/assessments\/start\/\d+(?:\/scales)?$/)
  await expect(page.getByRole('heading', { name: '척도 선택' })).toBeVisible()

  await page.getByRole('checkbox', { name: /PHQ-9/ }).check()
  await page.getByRole('button', { name: '검사 시작' }).click()

  await expect(page.getByRole('heading', { name: 'PHQ-9 입력' })).toBeVisible()

  for (let questionIndex = 0; questionIndex < 8; questionIndex += 1) {
    await answerQuestion(page, questionIndex, 0)
  }
  await answerQuestion(page, 8, 1)

  await expect(page.getByText('응답 완료 9 / 9')).toBeVisible()
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByRole('heading', { name: '세션 요약' })).toBeVisible()
  await expect(page.locator('tbody tr').filter({ hasText: 'PHQ-9' }).first()).toBeVisible()

  await page.getByLabel('세션 메모').fill(input.memo)
  await page.getByRole('button', { name: '세션 저장' }).click()

  await expect(page).toHaveURL(/\/assessments\/sessions\/\d+$/)
  await expect(page.getByRole('heading', { name: '세션 상세' })).toBeVisible()
  await expect(page.getByText('세션이 저장되었습니다.')).toBeVisible()
  await expect(getSessionDetailField(page, '상태')).toHaveText('완료')

  const detailUrl = page.url()

  return {
    sessionId: getSessionIdFromUrl(detailUrl),
  }
}

async function markCurrentSessionMisentered(page: Page, reason: string) {
  await page.getByRole('button', { name: '오입력 처리' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog.getByRole('heading', { name: '세션 오입력 처리' })).toBeVisible()
  await expect(dialog.getByText('세션과 하위 결과는 유지한 채 상태만 MISENTERED로 변경합니다.')).toBeVisible()
  await dialog.getByRole('textbox').fill(reason)
  await dialog.getByRole('button', { name: '오입력 처리' }).click()

  await expect(page.getByText('오입력 처리되었습니다.')).toBeVisible()
  await expect(getSessionDetailField(page, '상태')).toHaveText('오입력')
  await expect(getSessionDetailField(page, '사유')).toHaveText(reason)
}

async function waitForStatisticsPage(page: Page) {
  await expect(page).toHaveURL(/\/statistics$/)
  await expect(page.getByRole('heading', { name: '통계' })).toBeVisible()
  await expect(page.getByText('오입력 세션은 기본 제외된 기준으로 집계합니다.')).toBeVisible()
  await expect(page.locator('.stat-card').filter({ hasText: '전체 세션' }).locator('strong')).toBeVisible()
}

async function runStatisticsQuery(
  page: Page,
  input: {
    dateFrom: string
    dateTo: string
    alertScaleCode?: string
    alertType?: string
  },
) {
  await page.getByLabel('시작일').fill(input.dateFrom)
  await page.getByLabel('종료일').fill(input.dateTo)
  await expect(page.getByLabel('경고 척도').locator('option[value="PHQ9"]')).toHaveCount(1)
  await expect(page.getByLabel('경고 유형').locator('option[value="CRITICAL_ITEM"]')).toHaveCount(1)
  await page.getByLabel('경고 척도').selectOption(input.alertScaleCode ?? '')
  await page.getByLabel('경고 유형').selectOption(input.alertType ?? '')

  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/v1/statistics/summary') && response.ok()),
    page.waitForResponse((response) => response.url().includes('/api/v1/statistics/scales') && response.ok()),
    page.waitForResponse((response) => response.url().includes('/api/v1/statistics/alerts') && response.ok()),
    page.getByRole('button', { name: '조회' }).click(),
  ])

  await expect(page.locator('.stat-card').filter({ hasText: '전체 세션' }).locator('strong')).toBeVisible()
}

async function getStatisticsCardValue(page: Page, label: string) {
  const text = await page.locator('.stat-card').filter({ hasText: label }).locator('strong').first().textContent()
  return parseCount(text, label)
}

async function getScaleTableCounts(page: Page, scaleName: string) {
  const section = getStatisticsSection(page, '현재 운영 척도')
  const row = section.locator('tbody tr').filter({ hasText: scaleName }).first()
  const cells = row.locator('td')

  await expect(row).toContainText(scaleName)

  return {
    alertCount: parseCount(await cells.nth(2).textContent(), `${scaleName} alert count`),
    totalCount: parseCount(await cells.nth(1).textContent(), `${scaleName} total count`),
  }
}

async function getAlertRecordTotalCount(page: Page) {
  const section = getStatisticsSection(page, '경고 기록')

  if (await section.getByText('경고 기록이 없습니다.').isVisible()) {
    return 0
  }

  const summaryText = await section.getByText(/\d+건 \/ \d+페이지/).first().textContent()
  const matchedCount = summaryText?.match(/(\d+)건/)

  if (!matchedCount) {
    throw new Error(`Could not parse alert total count from text: ${summaryText}`)
  }

  return Number(matchedCount[1])
}

test.describe('실브라우저 통계 오입력 반영', () => {
  test('통계 화면은 오입력 세션을 기본 제외하고 경고 목록 drill-down도 같은 정책을 따른다', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const normalClientName = `PW 통계 정상 대상자 ${token}`
    const misenteredClientName = `PW 통계 오입력 대상자 ${token}`
    const normalSessionMemo = `Playwright 통계 정상 세션 ${token}`
    const misenteredSessionMemo = `Playwright 통계 오입력 세션 ${token}`
    const misenteredReason = `Playwright 통계 오입력 사유 ${token}`

    await login(page, ADMIN_LOGIN_ID, DEFAULT_PASSWORD, '관리자A')

    await page.goto('/statistics')
    await waitForStatisticsPage(page)
    await expect(page.getByLabel('오입력 포함')).toHaveCount(0)
    const today = await page.getByLabel('종료일').inputValue()

    await runStatisticsQuery(page, {
      dateFrom: today,
      dateTo: today,
      alertScaleCode: 'PHQ9',
      alertType: 'CRITICAL_ITEM',
    })

    const baselineSummary = {
      alertScaleCount: await getStatisticsCardValue(page, '경고 척도'),
      alertSessionCount: await getStatisticsCardValue(page, '경고 세션'),
      totalScaleCount: await getStatisticsCardValue(page, '전체 척도 시행'),
      totalSessionCount: await getStatisticsCardValue(page, '전체 세션'),
    }
    const baselinePhq9Counts = await getScaleTableCounts(page, 'PHQ-9')
    const baselineAlertRecordCount = await getAlertRecordTotalCount(page)

    await createClientThroughUi(page, {
      name: normalClientName,
      gender: 'MALE',
      birthDate: '19890517',
      phone: '01033334444',
    })

    const normalSession = await createPhq9SessionThroughUi(page, {
      clientName: normalClientName,
      memo: normalSessionMemo,
    })

    await createClientThroughUi(page, {
      name: misenteredClientName,
      gender: 'FEMALE',
      birthDate: '19940315',
      phone: '01045678901',
    })

    await createPhq9SessionThroughUi(page, {
      clientName: misenteredClientName,
      memo: misenteredSessionMemo,
    })
    await markCurrentSessionMisentered(page, misenteredReason)

    await page.goto('/statistics')
    await waitForStatisticsPage(page)

    await runStatisticsQuery(page, {
      dateFrom: today,
      dateTo: today,
      alertScaleCode: 'PHQ9',
      alertType: 'CRITICAL_ITEM',
    })

    await expect(page.locator('.stat-card').filter({ hasText: '전체 세션' })).toContainText(String(baselineSummary.totalSessionCount + 1))
    await expect(page.locator('.stat-card').filter({ hasText: '전체 척도 시행' })).toContainText(String(baselineSummary.totalScaleCount + 1))
    await expect(page.locator('.stat-card').filter({ hasText: '경고 세션' })).toContainText(String(baselineSummary.alertSessionCount + 1))
    await expect(page.locator('.stat-card').filter({ hasText: '경고 척도' })).toContainText(String(baselineSummary.alertScaleCount + 1))

    const afterPhq9Counts = await getScaleTableCounts(page, 'PHQ-9')
    expect(afterPhq9Counts.totalCount).toBe(baselinePhq9Counts.totalCount + 1)
    expect(afterPhq9Counts.alertCount).toBe(baselinePhq9Counts.alertCount + 1)

    const afterAlertRecordCount = await getAlertRecordTotalCount(page)
    expect(afterAlertRecordCount).toBe(baselineAlertRecordCount + 1)

    const alertSection = getStatisticsSection(page, '경고 기록')
    const normalAlertRow = alertSection.locator('tbody tr').filter({ hasText: normalClientName }).first()

    await expect(normalAlertRow).toContainText('관리자A')
    await expect(normalAlertRow).toContainText('PHQ-9')
    await expect(normalAlertRow).toContainText('9번 문항 응답으로 인해 추가 안전 확인이 필요합니다.')
    await expect(alertSection.locator('tbody tr').filter({ hasText: misenteredClientName })).toHaveCount(0)

    await normalAlertRow.click()

    await expect(page).toHaveURL(new RegExp(`/assessments/sessions/${normalSession.sessionId}\\?highlightScaleCode=PHQ9$`))
    await expect(getSessionDetailField(page, '대상자')).toHaveText(normalClientName)
    await expect(getSessionDetailField(page, '상태')).toHaveText('완료')
    await expect(page.getByTestId('session-scale-PHQ9')).toHaveAttribute('data-highlighted', 'true')
  })
})
