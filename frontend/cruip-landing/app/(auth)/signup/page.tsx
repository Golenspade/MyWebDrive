'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/auth-store'

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
    } catch (err: any) {
      setError(err?.message || '注册失败')
    }
  }

  // 使用 effect 监听认证状态，避免在 render 中导航
  useEffect(() => {
    if (!isAuthenticated) return
    const nextRole = useAuthStore.getState().role
    if (nextRole === 'admin') router.replace('/admin/overview')
    else router.replace('/account')
  }, [isAuthenticated, router])

  // Prefill invitation code from ?code=
  useEffect(() => {
    const code = searchParams?.get('code') ?? (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('code') : null)
    if (code && !invitationCode) {
      setInvitationCode(code)
    }
  }, [searchParams, invitationCode])

  return (
    <>
      <div className='mb-10'>
        <h1 className='text-4xl font-bold'>创建您的账户</h1>
      </div>
      {error && (
        <div className='mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600'>{error}</div>
      )}
      <form onSubmit={onSubmit}>
        <div className='space-y-4'>
          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700' htmlFor='name'>姓名</label>
            <input id='name' className='form-input w-full py-2' type='text' value={name} onChange={(e)=>setName(e.target.value)} required />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700' htmlFor='email'>邮箱</label>
            <input id='email' className='form-input w-full py-2' type='email' value={email} onChange={(e)=>setEmail(e.target.value)} required />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700' htmlFor='password'>密码</label>
            <input id='password' className='form-input w-full py-2' type='password' value={password} onChange={(e)=>setPassword(e.target.value)} required />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700' htmlFor='invitation'>邀请码</label>
            <input id='invitation' className='form-input w-full py-2' type='text' value={invitationCode} onChange={(e)=>setInvitationCode(e.target.value)} placeholder='请输入邀请码' required />
          </div>
        </div>
        <div className='mt-6'>
          <button disabled={isLoading} className='btn w-full bg-linear-to-t from-brand-primary-600 to-brand-primary-500 bg-[length:100%_100%] bg-[bottom] text-white shadow-sm hover:bg-[length:100%_150%] disabled:opacity-50'>
            {isLoading ? '注册中…' : '注册'}
          </button>
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
