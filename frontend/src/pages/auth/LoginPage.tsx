import { AuthFormShell } from '../../features/auth/components/AuthFormShell'
import { LoginForm } from '../../features/auth/components/LoginForm'

export function LoginPage() {
  return (
    <AuthFormShell
      description="seed 계정: `admina / Test1234!`, `usera / Test1234!`"
      title="다시서기 정신건강 평가관리 시스템"
    >
      <LoginForm />
    </AuthFormShell>
  )
}
