import { expect, test, type Locator, type Page } from '@playwright/test'

const ADMIN_LOGIN_ID = 'admina'
const USER_LOGIN_ID = 'usera'
const DEFAULT_PASSWORD = 'Test1234!'
const LOGIN_HEADING = '다시서기 정신건강 평가관리 시스템'
const ADMIN_NAME = '관리자A'
const USER_NAME = '사용자A'
const CLIENT_LIST_PATH_PATTERN = /\/clients$/
const ASSESSMENT_RECORDS_PATH_PATTERN = /\/assessment-records(?:\?.*)?$/
const ASSESSMENT_INPUT_PATH_PATTERN = /\/assessments\/start\/\d+\/input$/
const ASSESSMENT_SUMMARY_PATH_PATTERN = /\/assessments\/start\/\d+\/summary$/
const SESSION_DETAIL_PATH_PATTERN = /\/assessments\/sessions\/\d+(?:\?.*)?$/
const PHQ9_ALERT_TEXT = '9번 문항 응답으로 인해 추가 안전 확인이 필요합니다.'
const GAD7_ALERT_TEXT = '불안 증상 추가 평가 권고'
const PRINT_GUIDE_TEXT = "세션 상세의 출력용 화면입니다. 인쇄하려면 '인쇄'를 누르세요."
const MULTI_SCALE_PRINT_SUMMARY_TEXT = '총 2개 척도 시행, 경고 2건'

type ScaleInput = {
  scaleCode: 'PHQ9' | 'GAD7'
  scaleName: 'PHQ-9' | 'GAD-7'
  optionIndexes: number[]
  expectedAnsweredCount: number
  expectedPreviewTotalScore: number
  expectedTotalScore: number
  expectedResultLevel: string
  expectedAlertText: string
}

const MULTI_SCALE_INPUTS: ScaleInput[] = [
  {
    scaleCode: 'PHQ9',
    scaleName: 'PHQ-9',
    optionIndexes: [0, 0, 0, 0, 0, 0, 0, 0, 1],
    expectedAnsweredCount: 9,
    expectedPreviewTotalScore: 1,
    expectedTotalScore: 1,
    expectedResultLevel: '최소',
    expectedAlertText: PHQ9_ALERT_TEXT,
  },
  {
    scaleCode: 'GAD7',
    scaleName: 'GAD-7',
    optionIndexes: [2, 2, 2, 2, 2, 0, 0],
    expectedAnsweredCount: 7,
    expectedPreviewTotalScore: 10,
    expectedTotalScore: 10,
    expectedResultLevel: '중등도',
    expectedAlertText: GAD7_ALERT_TEXT,
  },
]

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

function getSessionIdFromUrl(url: string) {
  const matchedSessionId = new URL(url).pathname.match(/\/assessments\/sessions\/(\d+)$/)?.[1]
  const sessionId = Number(matchedSessionId)

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new Error(`Could not parse a session id from URL: ${url}`)
  }

  return sessionId
}

function getSessionDetailPathPattern(sessionId: number, scaleCode?: ScaleInput['scaleCode']) {
  if (!scaleCode) {
    return new RegExp(`/assessments/sessions/${sessionId}(?:\\?.*)?$`)
  }

  return new RegExp(`/assessments/sessions/${sessionId}\\?highlightScaleCode=${scaleCode}(?:&.*)?$`)
}

function getSessionPrintPathPattern(sessionId: number) {
  return new RegExp(`/assessments/sessions/${sessionId}/print$`)
}

function getSessionDetailField(page: Page, label: string) {
  return page.locator('.card.grid-2 .field').filter({ hasText: label }).locator('strong').first()
}

function getSessionPrintField(page: Page, label: string) {
  return page.locator('.card.grid-2 .field').filter({ hasText: label }).locator('strong').first()
}

function getSummaryRow(page: Page, scaleName: string) {
  return page.locator('table.table tbody tr').filter({ hasText: scaleName }).first()
}

function getAssessmentRecordRow(page: Page, clientName: string, scaleName: string) {
  return page.locator('table.table tbody tr').filter({ hasText: clientName }).filter({ hasText: scaleName }).first()
}

function getRecentSessionsSection(page: Page) {
  return page.locator('.card.stack').filter({ has: page.getByRole('heading', { name: '최근 검사 세션' }) }).first()
}

function getPrintScaleRow(printPage: Page, scaleName: string) {
  return printPage.locator('table.table tbody tr').filter({ hasText: scaleName }).first()
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

async function logout(page: Page) {
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expectLoginScreen(page)
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

  return {
    clientId: getClientIdFromUrl(page.url()),
    detailUrl: page.url(),
  }
}

async function setCheckboxState(locator: Locator, checked: boolean) {
  if ((await locator.isChecked()) === checked) {
    return
  }

  await locator.click()
}

async function searchAssessmentRecords(
  page: Page,
  input: {
    clientName: string
    includeMisentered: boolean
  },
) {
  await page.goto('/assessment-records')
  await expect(page).toHaveURL(ASSESSMENT_RECORDS_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '검사기록 목록' })).toBeVisible()

  await page.getByPlaceholder('대상자명').fill(input.clientName)
  await setCheckboxState(page.getByLabel('오입력 포함'), input.includeMisentered)
  await page.getByRole('button', { name: '조회' }).click()
}

async function answerQuestion(page: Page, questionIndex: number, optionIndex: number) {
  const question = page.locator('fieldset.assessment-question-card').nth(questionIndex)

  await question.locator('label.assessment-option').nth(optionIndex).click()
}

async function startMultiScaleAssessmentFromCurrentClientDetail(page: Page) {
  await page.getByRole('link', { name: '검사 시작' }).click()

  await expect(page).toHaveURL(/\/assessments\/start\/\d+(?:\/scales)?$/)
  await expect(page.getByRole('heading', { name: '척도 선택' })).toBeVisible()

  const phq9Checkbox = page.getByRole('checkbox', { name: /PHQ-9/ })
  const gad7Checkbox = page.getByRole('checkbox', { name: /GAD-7/ })

  await phq9Checkbox.check()
  await gad7Checkbox.check()
  await expect(phq9Checkbox).toBeChecked()
  await expect(gad7Checkbox).toBeChecked()

  await page.getByRole('button', { name: '검사 시작' }).click()
  await expect(page).toHaveURL(ASSESSMENT_INPUT_PATH_PATTERN)
}

async function answerScaleQuestions(page: Page, scale: ScaleInput, stepIndex: number, scaleCount: number) {
  await expect(page).toHaveURL(ASSESSMENT_INPUT_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: `${scale.scaleName} 입력` })).toBeVisible()
  await expect(page.getByText(`현재 단계 ${stepIndex} / ${scaleCount}`)).toBeVisible()

  for (const [questionIndex, optionIndex] of scale.optionIndexes.entries()) {
    await answerQuestion(page, questionIndex, optionIndex)
  }

  await expect(page.getByText(`응답 완료 ${scale.expectedAnsweredCount} / ${scale.expectedAnsweredCount}`)).toBeVisible()
}

async function completeMultiScaleSession(page: Page, sessionMemo: string) {
  await startMultiScaleAssessmentFromCurrentClientDetail(page)

  await answerScaleQuestions(page, MULTI_SCALE_INPUTS[0], 1, MULTI_SCALE_INPUTS.length)
  await page.getByRole('button', { name: '다음' }).click()

  await answerScaleQuestions(page, MULTI_SCALE_INPUTS[1], 2, MULTI_SCALE_INPUTS.length)
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page).toHaveURL(ASSESSMENT_SUMMARY_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '세션 요약' })).toBeVisible()

  for (const scale of MULTI_SCALE_INPUTS) {
    const summaryRow = getSummaryRow(page, scale.scaleName)

    await expect(summaryRow.locator('td').nth(0)).toHaveText(scale.scaleName)
    await expect(summaryRow.locator('td').nth(1)).toHaveText(`${scale.expectedAnsweredCount} / ${scale.expectedAnsweredCount}`)
    await expect(summaryRow.locator('td').nth(2)).toHaveText(String(scale.expectedPreviewTotalScore))
  }

  await page.getByLabel('세션 메모').fill(sessionMemo)
  await page.getByRole('button', { name: '세션 저장' }).click()

  await expect(page).toHaveURL(SESSION_DETAIL_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '세션 상세' })).toBeVisible()

  const detailUrl = page.url()
  const sessionNo = (await getSessionDetailField(page, '세션번호').textContent())?.trim()

  if (!sessionNo) {
    throw new Error('Could not read the saved session number from the session detail page.')
  }

  return {
    detailUrl,
    sessionId: getSessionIdFromUrl(detailUrl),
    sessionNo,
  }
}

async function expectMultiScaleSessionDetail(
  page: Page,
  input: {
    sessionNo: string
    sessionMemo: string
    status: '완료' | '오입력'
    misenteredReason?: string
  },
) {
  await expect(page.locator('[data-testid^="session-scale-"]')).toHaveCount(MULTI_SCALE_INPUTS.length)
  await expect(getSessionDetailField(page, '세션번호')).toHaveText(input.sessionNo)
  await expect(getSessionDetailField(page, '상태')).toHaveText(input.status)
  await expect(getSessionDetailField(page, '세션 메모')).toHaveText(input.sessionMemo)

  if (input.status === '오입력') {
    await expect(getSessionDetailField(page, '오입력 처리 시각')).not.toHaveText('-')
    await expect(getSessionDetailField(page, '처리자')).toHaveText(ADMIN_NAME)
    await expect(getSessionDetailField(page, '사유')).toHaveText(input.misenteredReason ?? '')
  }

  for (const scale of MULTI_SCALE_INPUTS) {
    const scaleCard = page.getByTestId(`session-scale-${scale.scaleCode}`)

    await expect(scaleCard).toContainText(scale.scaleName)
    await expect(scaleCard).toContainText(`총점 ${scale.expectedTotalScore} / ${scale.expectedResultLevel}`)
    await expect(scaleCard).toContainText(scale.expectedAlertText)
  }

  await expect(page.getByRole('heading', { name: '경고' })).toBeVisible()
  await expect(page.getByText(`[PHQ-9] ${PHQ9_ALERT_TEXT}`)).toBeVisible()
  await expect(page.getByText(`[GAD-7] ${GAD7_ALERT_TEXT}`)).toBeVisible()
}

async function expectMultiScaleAssessmentRecords(
  page: Page,
  input: {
    clientName: string
    sessionId: number
    statusLabel: '정상' | '오입력'
  },
) {
  const expectedDataStatus = input.statusLabel === '정상' ? 'COMPLETED' : 'MISENTERED'

  await expect(page.locator('table.table tbody tr')).toHaveCount(MULTI_SCALE_INPUTS.length)

  for (const scale of MULTI_SCALE_INPUTS) {
    const recordRow = getAssessmentRecordRow(page, input.clientName, scale.scaleName)
    const detailLink = recordRow.getByRole('link', { name: '상세 보기' })

    await expect(recordRow).toContainText(String(scale.expectedTotalScore))
    await expect(recordRow).toContainText(scale.expectedResultLevel)
    await expect(recordRow).toContainText('있음')
    await expect(recordRow.locator(`[data-status="${expectedDataStatus}"]`)).toHaveText(input.statusLabel)
    await expect(detailLink).toHaveAttribute('href', getSessionDetailPathPattern(input.sessionId, scale.scaleCode))
  }
}

async function openSessionPrintPageFromDetail(page: Page) {
  const printPagePromise = page.context().waitForEvent('page')

  await page.getByRole('button', { name: '출력 보기' }).click()

  const printPage = await printPagePromise
  await printPage.waitForLoadState('domcontentloaded')
  return printPage
}

async function expectMultiScalePrintPage(
  printPage: Page,
  input: {
    sessionId: number
    clientName: string
    sessionNo: string
  },
) {
  await expect(printPage).toHaveURL(getSessionPrintPathPattern(input.sessionId))
  await expect(printPage.locator('h1')).toHaveText(/\S+/)
  await expect(printPage.getByText(PRINT_GUIDE_TEXT)).toBeVisible()
  await expect(printPage.getByRole('button', { name: '인쇄' })).toBeVisible()
  await expect(getSessionPrintField(printPage, '대상자')).toHaveText(input.clientName)
  await expect(getSessionPrintField(printPage, '세션 번호')).toHaveText(input.sessionNo)
  await expect(printPage.getByText(MULTI_SCALE_PRINT_SUMMARY_TEXT)).toBeVisible()
  await expect(printPage.locator('table.table tbody tr')).toHaveCount(MULTI_SCALE_INPUTS.length)

  for (const scale of MULTI_SCALE_INPUTS) {
    const printRow = getPrintScaleRow(printPage, scale.scaleName)

    await expect(printRow.locator('td').nth(0)).toHaveText(scale.scaleName)
    await expect(printRow.locator('td').nth(1)).toHaveText(String(scale.expectedTotalScore))
    await expect(printRow.locator('td').nth(2)).toContainText(scale.expectedResultLevel)
    await expect(printRow.locator('td').nth(3)).toHaveText(scale.expectedAlertText)
  }
}

async function markCurrentSessionMisentered(page: Page, reason: string) {
  await page.getByRole('button', { name: '오입력 처리' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog.getByRole('heading', { name: '세션 오입력 처리' })).toBeVisible()
  await expect(dialog.getByText('세션과 하위 결과는 유지한 채 상태만 MISENTERED로 변경합니다.')).toBeVisible()
  await dialog.getByRole('textbox').fill(reason)
  await dialog.getByRole('button', { name: '오입력 처리' }).click()
}

test.describe('실브라우저 다중 척도 세션 저장', () => {
  test('한 세션에서 PHQ-9와 GAD-7을 함께 저장하고 세션 단위 반영을 검증한다', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const clientName = `PW 다중 척도 대상자 ${token}`
    const sessionMemo = `Playwright 다중 척도 세션 ${token}`

    await login(page, ADMIN_LOGIN_ID, DEFAULT_PASSWORD, ADMIN_NAME)

    const client = await createClientThroughUi(page, {
      name: clientName,
      gender: 'FEMALE',
      birthDate: '19920418',
      phone: '01067891234',
    })

    const { sessionId, sessionNo } = await completeMultiScaleSession(page, sessionMemo)

    await expect(page.getByText('세션이 저장되었습니다.')).toBeVisible()
    await expectMultiScaleSessionDetail(page, {
      sessionNo,
      sessionMemo,
      status: '완료',
    })

    await searchAssessmentRecords(page, { clientName, includeMisentered: false })
    await expectMultiScaleAssessmentRecords(page, {
      clientName,
      sessionId,
      statusLabel: '정상',
    })

    const highlightedScale = MULTI_SCALE_INPUTS[0]
    const highlightedRecordRow = getAssessmentRecordRow(page, clientName, highlightedScale.scaleName)

    await highlightedRecordRow.getByRole('link', { name: '상세 보기' }).click()

    await expect(page).toHaveURL(getSessionDetailPathPattern(sessionId, highlightedScale.scaleCode))
    await expectMultiScaleSessionDetail(page, {
      sessionNo,
      sessionMemo,
      status: '완료',
    })
    await expect(page.getByTestId(`session-scale-${highlightedScale.scaleCode}`)).toHaveAttribute('data-highlighted', 'true')

    await page.goto(client.detailUrl)
    await expect(page.getByRole('heading', { name: `${clientName} 상세` })).toBeVisible()
    await expect(page.getByText('최근 검사 세션')).toBeVisible()

    const recentSessionsSection = getRecentSessionsSection(page)
    const recentSessionRow = recentSessionsSection.locator('tbody tr').filter({ hasText: sessionNo }).first()
    const recentSessionCells = recentSessionRow.locator('td')
    const recentSessionDetailLink = recentSessionRow.getByRole('link', { name: '세션 상세' })

    await expect(recentSessionRow).toBeVisible()
    await expect(recentSessionCells.nth(0)).toHaveText(sessionNo)
    await expect(recentSessionCells.nth(3)).toHaveText(String(MULTI_SCALE_INPUTS.length))
    await expect(recentSessionCells.nth(4)).toHaveText('있음')
    await expect(recentSessionDetailLink).toHaveAttribute('href', `/assessments/sessions/${sessionId}`)

    await recentSessionDetailLink.click()
    await expect(page).toHaveURL(new RegExp(`/assessments/sessions/${sessionId}$`))
    await expectMultiScaleSessionDetail(page, {
      sessionNo,
      sessionMemo,
      status: '완료',
    })

    const printPage = await openSessionPrintPageFromDetail(page)

    await expectMultiScalePrintPage(printPage, {
      sessionId,
      clientName,
      sessionNo,
    })
    await printPage.close()
  })

  test('관리자는 다중 척도 세션을 오입력 처리하고 목록과 출력 및 접근 정책을 검증한다', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const clientName = `PW 다중 척도 오입력 ${token}`
    const sessionMemo = `Playwright 다중 척도 오입력 ${token}`
    const misenteredReason = `Playwright 다중 척도 오입력 사유 ${token}`

    await login(page, ADMIN_LOGIN_ID, DEFAULT_PASSWORD, ADMIN_NAME)

    const client = await createClientThroughUi(page, {
      name: clientName,
      gender: 'MALE',
      birthDate: '19910312',
      phone: '01045671234',
    })

    const { sessionId, sessionNo } = await completeMultiScaleSession(page, sessionMemo)

    await expect(page.getByText('세션이 저장되었습니다.')).toBeVisible()
    await expectMultiScaleSessionDetail(page, {
      sessionNo,
      sessionMemo,
      status: '완료',
    })

    await markCurrentSessionMisentered(page, misenteredReason)

    await expect(page.getByText('오입력 처리되었습니다.')).toBeVisible()
    await expectMultiScaleSessionDetail(page, {
      sessionNo,
      sessionMemo,
      status: '오입력',
      misenteredReason,
    })
    await expect(page.getByRole('button', { name: '오입력 처리' })).toHaveCount(0)

    const misenteredPrintPage = await openSessionPrintPageFromDetail(page)

    await expectMultiScalePrintPage(misenteredPrintPage, {
      sessionId,
      clientName,
      sessionNo,
    })
    await misenteredPrintPage.close()

    await searchAssessmentRecords(page, { clientName, includeMisentered: false })
    await expect(page.getByText('조회된 검사기록이 없습니다.')).toBeVisible()

    await searchAssessmentRecords(page, { clientName, includeMisentered: true })
    await expectMultiScaleAssessmentRecords(page, {
      clientName,
      sessionId,
      statusLabel: '오입력',
    })

    const highlightedScale = MULTI_SCALE_INPUTS[1]
    const misenteredRecordRow = getAssessmentRecordRow(page, clientName, highlightedScale.scaleName)

    await misenteredRecordRow.getByRole('link', { name: '상세 보기' }).click()

    await expect(page).toHaveURL(getSessionDetailPathPattern(sessionId, highlightedScale.scaleCode))
    await expectMultiScaleSessionDetail(page, {
      sessionNo,
      sessionMemo,
      status: '오입력',
      misenteredReason,
    })
    await expect(page.getByTestId(`session-scale-${highlightedScale.scaleCode}`)).toHaveAttribute('data-highlighted', 'true')

    await page.goto(client.detailUrl)
    await expect(page.getByRole('heading', { name: `${clientName} 상세` })).toBeVisible()
    await expect(page.getByText('아직 저장된 검사 세션이 없습니다.')).toBeVisible()

    await logout(page)

    await login(page, USER_LOGIN_ID, DEFAULT_PASSWORD, USER_NAME)

    await searchAssessmentRecords(page, { clientName, includeMisentered: true })
    await expect(page.getByText('조회된 검사기록이 없습니다.')).toBeVisible()

    await page.goto(`/assessments/sessions/${sessionId}`)
    await expect(page.getByText('세션 상세를 볼 수 없습니다.')).toBeVisible()
    await expect(page.getByText('해당 세션을 조회할 권한이 없습니다.')).toBeVisible()

    await page.goto(`/assessments/sessions/${sessionId}/print`)
    await expect(page).toHaveURL(getSessionPrintPathPattern(sessionId))
    await expect(page.getByText('해당 세션을 조회할 권한이 없습니다.')).toBeVisible()
    await expect(page.getByText(PRINT_GUIDE_TEXT)).toHaveCount(0)
  })
})
