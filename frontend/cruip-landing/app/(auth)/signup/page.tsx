'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function SignUpInner() {
  const router = useRouter()
  const { register, isLoading, isAuthenticated } = useAuthStore()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invitationCode, setInvitationCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (!invitationCode.trim()) {
        setError('请输入有效的邀请码')
        return
      }
      // 仅完成注册与状态更新，导航放在下面的 effect 中统一处理，避免竞态导致 404
      await register({ name, email, password, invitationCode: invitationCode.trim() })
    } catch (err) {
      const message = err instanceof Error ? err.message : null
      setError(message || '注册失败')
    }
  }

  // 使用 effect 监听认证状态，避免在 render 中导航
  useEffect(() => {
    if (!isAuthenticated) return
    const nextRole = useAuthStore.getState().role
    if (nextRole === 'admin') router.replace('/admin/overview')
    else router.replace('/account')
  }, [isAuthenticated, router])

  useEffect(() => {
    const code = searchParams?.get('code') ?? (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('code') : null)
    if (code && !invitationCode) {
      setInvitationCode(code)
    }
  }, [searchParams, invitationCode])

  return (
    <>
      <div className='mb-8'>
        <h1 className='font-nothing-head text-2xl font-semibold text-nothing-display'>创建您的账户</h1>
      </div>

      {error && (
        <div className='mb-6 rounded-[var(--nothing-r-sm)] border-l-[3px] border-nothing-error bg-nothing-error/10 p-3 text-sm text-nothing-primary'>
          {error}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className='space-y-5'>
          <div>
            <label className='label-nothing' htmlFor='name'>姓名</label>
            <Input
              id='name'
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder='请输入姓名'
              className='border-0 border-b border-nothing-line-2 rounded-none bg-transparent px-0 pt-0 pb-3 focus-visible:border-nothing-display'
            />
          </div>
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
          <div>
            <label className='label-nothing' htmlFor='invitation'>邀请码</label>
            <Input
              id='invitation'
              type='text'
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value)}
              placeholder='请输入邀请码'
              required
              className='border-0 border-b border-nothing-line-2 rounded-none bg-transparent px-0 pt-0 pb-3 focus-visible:border-nothing-display'
            />
          </div>
        </div>

        <div className='mt-8'>
          <Button type='submit' disabled={isLoading} className='h-11 w-full'>
            {isLoading ? '注册中…' : '注册'}
          </Button>
        </div>
      </form>
    </>
  )
}

export default function SignUp() {
  return (
    <Suspense>
      <SignUpInner />
    </Suspense>
  )
}
