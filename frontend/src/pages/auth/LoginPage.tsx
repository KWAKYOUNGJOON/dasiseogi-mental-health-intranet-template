import { useAppMetadata } from '../../app/providers/AppMetadataProvider'
import { AuthFormShell } from '../../features/auth/components/AuthFormShell'
import { LoginForm } from '../../features/auth/components/LoginForm'

export function LoginPage() {
  const { organizationName } = useAppMetadata()

  return (
    <AuthFormShell
      description="업무용 계정 정보를 입력해 로그인해주세요."
      title={organizationName || '기관 정보 확인 중'}
    >
      <LoginForm />
    </AuthFormShell>
  )
}
