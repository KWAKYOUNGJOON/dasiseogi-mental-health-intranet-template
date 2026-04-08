const CLIENT_GENDER_OPTION_LABELS = {
  MALE: '남성',
  FEMALE: '여성',
  OTHER: '기타',
  UNKNOWN: '미상',
} as const

export const CLIENT_GENDER_OPTIONS = [
  { value: 'MALE', label: CLIENT_GENDER_OPTION_LABELS.MALE },
  { value: 'FEMALE', label: CLIENT_GENDER_OPTION_LABELS.FEMALE },
  { value: 'OTHER', label: CLIENT_GENDER_OPTION_LABELS.OTHER },
  { value: 'UNKNOWN', label: CLIENT_GENDER_OPTION_LABELS.UNKNOWN },
] as const satisfies ReadonlyArray<{ value: string; label: string }>

export const CLIENT_GENDER_LABELS: Readonly<Record<string, string>> = {
  MALE: CLIENT_GENDER_OPTION_LABELS.MALE,
  FEMALE: CLIENT_GENDER_OPTION_LABELS.FEMALE,
}

export const CLIENT_STATUS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: '활성',
  INACTIVE: '비활성',
  MISREGISTERED: '오등록',
}

export const SESSION_STATUS_LABELS: Readonly<Record<string, string>> = {
  COMPLETED: '완료',
  MISENTERED: '오입력',
}

function getDisplayLabel(value: string | null | undefined, labels: Readonly<Record<string, string>>) {
  if (!value) {
    return '-'
  }

  return labels[value] ?? value
}

export function getClientGenderLabel(gender: string | null | undefined) {
  return getDisplayLabel(gender, CLIENT_GENDER_LABELS)
}

export function getClientStatusLabel(status: string | null | undefined) {
  return getDisplayLabel(status, CLIENT_STATUS_LABELS)
}

export function getSessionStatusLabel(status: string | null | undefined) {
  return getDisplayLabel(status, SESSION_STATUS_LABELS)
}
