import { AuthFormShell } from '../../features/auth/components/AuthFormShell'
import { LoginForm } from '../../features/auth/components/LoginForm'

export function LoginPage() {
  return (
    <AuthFormShell
      description="업무용 계정 정보를 입력해 로그인해주세요."
      title="다시서기 정신건강 평가관리 시스템"
    >
      <LoginForm />
    </AuthFormShell>
  )
}
