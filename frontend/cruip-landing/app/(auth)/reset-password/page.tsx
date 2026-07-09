import { ResetPasswordForm } from './reset-password-form'

export const metadata = {
  title: 'Reset Password - MyWebDrive',
  description: '重置您的密码',
}

// This page intentionally kept server-only. If you need shared constants or
// helper functions, move them to a separate module and import them here to
// keep Fast Refresh working as expected.
export default function ResetPassword() {
  return (
    <>
      <div className='mb-8'>
        <h1 className='font-nothing-head text-2xl font-semibold text-nothing-display'>
          重置密码
        </h1>
      </div>

      <ResetPasswordForm />
    </>
  )
}
