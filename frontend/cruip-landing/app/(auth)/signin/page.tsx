'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function SignIn() {
  const router = useRouter()
  const { login, isLoading, isAuthenticated, role } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      const nextRole = useAuthStore.getState().role
      if (nextRole === 'admin') router.push('/admin/overview')
      else router.push('/account')
    } catch (err) {
      const message = err instanceof Error ? err.message : null
      setError(message || '登录失败')
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    if (role === 'admin') router.replace('/admin/overview')
    else router.replace('/account')
  }, [isAuthenticated, role, router])

  return (
    <>
      <div className='mb-8'>
        <h1 className='font-nothing-head text-2xl font-semibold text-nothing-display'>登录到您的账户</h1>
      </div>

      {error && (
        <div className='mb-6 rounded-[var(--nothing-r-sm)] border-l-[3px] border-nothing-error bg-nothing-error/10 p-3 text-sm text-nothing-primary'>
          {error}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className='space-y-5'>
          <div>
            <label className='label-nothing' htmlFor='email'>邮箱</label>
            <Input
              id='email'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder='请输入邮箱'
              className='border-0 border-b border-nothing-line-2 rounded-none bg-transparent px-0 pt-0 pb-3 focus-visible:border-nothing-display'
            />
          </div>
          <div>
            <label className='label-nothing' htmlFor='password'>密码</label>
            <Input
              id='password'
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder='请输入密码'
              className='border-0 border-b border-nothing-line-2 rounded-none bg-transparent px-0 pt-0 pb-3 focus-visible:border-nothing-display'
            />
          </div>
        </div>

        <div className='mt-8'>
          <Button type='submit' disabled={isLoading} className='h-11 w-full'>
            {isLoading ? '登录中…' : '登录'}
          </Button>
        </div>
      </form>

      <div className='mt-6 text-center'>
        <Link
          className='text-sm text-nothing-secondary transition-opacity duration-200 ease-in-out hover:opacity-80'
          href='/reset-password'
        >
          忘记密码
        </Link>
      </div>
    </>
  )
}
