'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Step = 'email' | 'code'

export default function SignIn() {
  const router = useRouter()
  const {
    requestEmailCode,
    verifyEmailCode,
    isLoading,
    isAuthenticated,
    role,
  } = useAuthStore()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [resendAfterSeconds, setResendAfterSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (resendAfterSeconds <= 0) return
    const timer = window.setInterval(() => {
      setResendAfterSeconds((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendAfterSeconds])

  useEffect(() => {
    if (!isAuthenticated) return
    if (role === 'admin') router.replace('/admin/overview')
    else router.replace('/account')
  }, [isAuthenticated, role, router])

  async function requestCode() {
    const normalizedEmail = email.trim().toLowerCase()
    const challenge = await requestEmailCode(normalizedEmail)
    setEmail(normalizedEmail)
    setChallengeId(challenge.challengeId)
    setResendAfterSeconds(challenge.resendAfterSeconds)
    setCode('')
    setStep('code')
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      if (step === 'email') {
        await requestCode()
        return
      }
      if (!challengeId || !/^\d{6}$/.test(code)) {
        setError('请输入 6 位数字验证码')
        return
      }
      await verifyEmailCode({ challengeId, email, code })
      const nextRole = useAuthStore.getState().role
      if (nextRole === 'admin') router.push('/admin/overview')
      else router.push('/account')
    } catch (err) {
      const message = err instanceof Error ? err.message : null
      setError(message || (step === 'email' ? '验证码发送失败' : '验证码校验失败'))
    }
  }

  async function resendCode() {
    if (resendAfterSeconds > 0 || isLoading) return
    setError(null)
    try {
      await requestCode()
    } catch (err) {
      const message = err instanceof Error ? err.message : null
      setError(message || '验证码发送失败')
    }
  }

  return (
    <>
      <div className='mb-8'>
        <h1 className='font-nothing-head text-2xl font-semibold text-nothing-display'>
          {step === 'email' ? '使用邮箱登录' : '输入验证码'}
        </h1>
        {step === 'code' && (
          <p className='mt-2 text-sm text-nothing-secondary'>验证码已发送至 {email}</p>
        )}
      </div>

      {error && (
        <div className='mb-6 rounded-[var(--nothing-r-sm)] border-l-[3px] border-nothing-error bg-nothing-error/10 p-3 text-sm text-nothing-primary'>
          {error}
        </div>
      )}

      <form onSubmit={onSubmit}>
        {step === 'email' ? (
          <div>
            <label className='label-nothing' htmlFor='email'>邮箱</label>
            <Input
              id='email'
              type='email'
              autoComplete='email'
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder='请输入邮箱'
              className='rounded-none border-0 border-b border-nothing-line-2 bg-transparent px-0 pb-3 pt-0 focus-visible:border-nothing-display'
            />
          </div>
        ) : (
          <div>
            <label className='label-nothing' htmlFor='code'>6 位验证码</label>
            <Input
              id='code'
              type='text'
              inputMode='numeric'
              autoComplete='one-time-code'
              pattern='[0-9]{6}'
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              autoFocus
              placeholder='000000'
              className='rounded-none border-0 border-b border-nothing-line-2 bg-transparent px-0 pb-3 pt-0 font-nothing-mono tracking-[0.4em] focus-visible:border-nothing-display'
            />
          </div>
        )}

        <div className='mt-8'>
          <Button
            type='submit'
            disabled={isLoading || (step === 'code' && code.length !== 6)}
            className='h-11 w-full'
          >
            {isLoading ? '处理中…' : step === 'email' ? '发送验证码' : '验证并登录'}
          </Button>
        </div>
      </form>

      {step === 'code' && (
        <div className='mt-6 flex items-center justify-between text-sm'>
          <button
            type='button'
            onClick={() => {
              setStep('email')
              setChallengeId(null)
              setCode('')
            }}
            className='text-nothing-secondary transition-opacity hover:opacity-80'
          >
            更换邮箱
          </button>
          <button
            type='button'
            onClick={resendCode}
            disabled={resendAfterSeconds > 0 || isLoading}
            className='text-nothing-secondary transition-opacity enabled:hover:opacity-80 disabled:opacity-50'
          >
            {resendAfterSeconds > 0 ? `${resendAfterSeconds} 秒后重发` : '重新发送'}
          </button>
        </div>
      )}
    </>
  )
}
