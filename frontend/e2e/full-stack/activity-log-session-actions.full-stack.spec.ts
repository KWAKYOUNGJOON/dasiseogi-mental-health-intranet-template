import { expect, test, type Page } from '@playwright/test'

const ADMIN_LOGIN_ID = 'admina'
const DEFAULT_PASSWORD = 'Test1234!'
const LOGIN_HEADING = '다시서기 정신건강 평가관리 시스템'
const CLIENT_LIST_PATH_PATTERN = /\/clients$/
const ADMIN_LOGS_PATH_PATTERN = /\/admin\/logs$/

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

function getCurrentSeoulDateText(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const lookup = new Map(parts.map((part) => [part.type, part.value]))

  return `${lookup.get('year')}-${lookup.get('month')}-${lookup.get('day')}`
}

function getSessionDetailField(page: Page, label: string) {
  return page.locator('.card.grid-2 .field').filter({ hasText: label }).locator('strong').first()
}

function getSessionPrintField(page: Page, label: string) {
  return page.locator('.card.grid-2 .field').filter({ hasText: label }).locator('strong').first()
}

async function expectLoginScreen(page: Page) {
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  await expect(page.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible()
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

async function createPhq9SessionThroughUi(page: Page, memo: string) {
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

  await page.getByLabel('세션 메모').fill(memo)
  await page.getByRole('button', { name: '세션 저장' }).click()

  await expect(page).toHaveURL(/\/assessments\/sessions\/\d+$/)
  await expect(page.getByRole('heading', { name: '세션 상세' })).toBeVisible()

  const detailUrl = page.url()
  const sessionNo = (await getSessionDetailField(page, '세션번호').textContent())?.trim()

  if (!sessionNo) {
    throw new Error('Could not read the saved session number from the session detail page.')
  }

  return {
    sessionId: getSessionIdFromUrl(detailUrl),
    sessionNo,
  }
}

async function openSessionPrintPageFromDetail(page: Page) {
  const printPagePromise = page.context().waitForEvent('page')

  await page.getByRole('button', { name: '출력 보기' }).click()

  const printPage = await printPagePromise
  await printPage.waitForLoadState('domcontentloaded')
  return printPage
}

async function markCurrentSessionMisentered(page: Page, reason: string) {
  await page.getByRole('button', { name: '오입력 처리' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog.getByRole('heading', { name: '세션 오입력 처리' })).toBeVisible()
  await expect(dialog.getByText('세션과 하위 결과는 유지한 채 상태만 MISENTERED로 변경합니다.')).toBeVisible()
  await dialog.getByRole('textbox').fill(reason)
  await dialog.getByRole('button', { name: '오입력 처리' }).click()
}

async function openActivityLogPage(page: Page) {
  await page.getByRole('link', { name: '로그 확인' }).click()

  await expect(page).toHaveURL(ADMIN_LOGS_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '로그 확인' })).toBeVisible()
  await expect(page.getByRole('button', { name: '조회', exact: true })).toBeEnabled()
}

async function filterActivityLogs(
  page: Page,
  input: {
    dateFrom: string
    dateTo: string
    actionType: 'PRINT_SESSION' | 'SESSION_MARK_MISENTERED'
  },
) {
  await page.getByLabel('시작일').fill(input.dateFrom)
  await page.getByLabel('종료일').fill(input.dateTo)
  await page.getByLabel('기능 유형').selectOption(input.actionType)
  await page.getByLabel('페이지 크기').selectOption('50')
  await page.getByRole('button', { name: '조회', exact: true }).click()
}

function getActivityLogRow(
  page: Page,
  input: {
    actionLabel: string
    sessionId: number
    sessionNo: string
  },
) {
  return page
    .locator('tbody tr')
    .filter({ hasText: input.actionLabel })
    .filter({ hasText: `${input.sessionNo} (SESSION #${input.sessionId})` })
    .first()
}

test.describe('실브라우저 활동 로그 세션 액션', () => {
  test('관리자가 출력 보기와 오입력 처리 후 활동 로그에서 세션 액션을 확인한다', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const clientName = `PW 로그 대상자 ${token}`
    const sessionMemo = `Playwright 로그 세션 ${token}`
    const misenteredReason = `Playwright 로그 오입력 사유 ${token}`
    const today = getCurrentSeoulDateText()

    await login(page, ADMIN_LOGIN_ID, DEFAULT_PASSWORD, '관리자A')

    await createClientThroughUi(page, {
      name: clientName,
      gender: 'FEMALE',
      birthDate: '19920413',
      phone: '01078901234',
    })

    const { sessionId, sessionNo } = await createPhq9SessionThroughUi(page, sessionMemo)

    await expect(page.getByText('세션이 저장되었습니다.')).toBeVisible()
    await expect(getSessionDetailField(page, '세션번호')).toHaveText(sessionNo)
    await expect(getSessionDetailField(page, '상태')).toHaveText('완료')
    await expect(getSessionDetailField(page, '세션 메모')).toHaveText(sessionMemo)
    await expect(page.getByTestId('session-scale-PHQ9')).toContainText('총점 1 / 최소')

    const printPage = await openSessionPrintPageFromDetail(page)

    await expect(printPage).toHaveURL(new RegExp(`/assessments/sessions/${sessionId}/print$`))
    await expect(printPage.getByText("세션 상세의 출력용 화면입니다. 인쇄하려면 '인쇄'를 누르세요.")).toBeVisible()
    await expect(printPage.getByRole('button', { name: '인쇄' })).toBeVisible()
    await expect(getSessionPrintField(printPage, '대상자')).toHaveText(clientName)
    await expect(getSessionPrintField(printPage, '세션 번호')).toHaveText(sessionNo)
    await printPage.close()

    await markCurrentSessionMisentered(page, misenteredReason)

    await expect(page.getByText('오입력 처리되었습니다.')).toBeVisible()
    await expect(getSessionDetailField(page, '세션번호')).toHaveText(sessionNo)
    await expect(getSessionDetailField(page, '상태')).toHaveText('오입력')
    await expect(getSessionDetailField(page, '사유')).toHaveText(misenteredReason)
    await expect(getSessionDetailField(page, '처리자')).toHaveText('관리자A')

    await openActivityLogPage(page)

    await filterActivityLogs(page, {
      dateFrom: today,
      dateTo: today,
      actionType: 'PRINT_SESSION',
    })

    const printLogRow = getActivityLogRow(page, {
      actionLabel: 'PRINT_SESSION (출력 보기)',
      sessionId,
      sessionNo,
    })

    await expect(printLogRow).toContainText('관리자A')
    await expect(printLogRow).toContainText('PRINT_SESSION (출력 보기)')
    await expect(printLogRow).toContainText(`${sessionNo} (SESSION #${sessionId})`)
    await expect(printLogRow).toContainText('세션 출력 데이터 조회')

    await filterActivityLogs(page, {
      dateFrom: today,
      dateTo: today,
      actionType: 'SESSION_MARK_MISENTERED',
    })

    const misenteredLogRow = getActivityLogRow(page, {
      actionLabel: 'SESSION_MARK_MISENTERED (검사 오입력 처리)',
      sessionId,
      sessionNo,
    })

    await expect(misenteredLogRow).toContainText('관리자A')
    await expect(misenteredLogRow).toContainText('SESSION_MARK_MISENTERED (검사 오입력 처리)')
    await expect(misenteredLogRow).toContainText(`${sessionNo} (SESSION #${sessionId})`)
    await expect(misenteredLogRow).toContainText('세션 오입력 처리')
  })
})
