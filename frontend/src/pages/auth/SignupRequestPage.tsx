import { AuthFormShell } from '../../features/auth/components/AuthFormShell'
import { SignupRequestForm } from '../../features/auth/components/SignupRequestForm'

export function SignupRequestPage() {
  return (
    <AuthFormShell description="관리자 승인 후 로그인할 수 있습니다." title="회원가입 신청">
      <SignupRequestForm />
    </AuthFormShell>
  )
}
