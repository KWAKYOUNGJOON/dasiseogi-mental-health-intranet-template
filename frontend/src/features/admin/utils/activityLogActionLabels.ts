export const ACTIVITY_LOG_ACTION_LABELS: Readonly<Record<string, string>> = {
  LOGIN: '로그인',
  SIGNUP_REQUEST: '회원가입 신청',
  SIGNUP_APPROVE: '회원가입 승인',
  SIGNUP_REJECT: '회원가입 반려',
  USER_ROLE_CHANGE: '사용자 권한 변경',
  USER_STATUS_CHANGE: '사용자 상태 변경',
  USER_POSITION_NAME_CHANGE: '사용자 직책 변경',
  USER_PROFILE_UPDATE: '내 정보 수정',
  CLIENT_CREATE: '대상자 등록',
  CLIENT_UPDATE: '대상자 정보 수정',
  CLIENT_MARK_MISREGISTERED: '대상자 오등록 처리',
  SESSION_CREATE: '검사 세션 생성',
  SESSION_MARK_MISENTERED: '검사 오입력 처리',
  PRINT_SESSION: '출력 보기',
  STATISTICS_EXPORT: '통계 내보내기',
  BACKUP_RUN: '백업 실행',
}

export function formatActivityLogActionLabel(actionType: string) {
  const normalizedActionType = actionType.trim()
  const label = ACTIVITY_LOG_ACTION_LABELS[normalizedActionType]

  if (!normalizedActionType || !label) {
    return normalizedActionType || actionType
  }

  return `${normalizedActionType} (${label})`
}
