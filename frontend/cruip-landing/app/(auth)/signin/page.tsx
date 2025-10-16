'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/auth-store'

export default function SignIn() {
  const router = useRouter()
  const { login, isLoading, isAuthenticated } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      router.push('/admin')
    } catch (err: any) {
      setError(err?.message || '登录失败')
    }
  }

  if (isAuthenticated) {
    router.replace('/admin')
    return null
  }

  return (
    <>
      <div className='mb-10'>
        <h1 className='text-4xl font-bold'>登录到您的账户</h1>
      </div>
      {error && (
        <div className='mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600'>{error}</div>
      )}
      <form onSubmit={onSubmit}>
        <div className='space-y-4'>
          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700' htmlFor='email'>邮箱</label>
            <input id='email' className='form-input w-full py-2' type='email' value={email} onChange={(e)=>setEmail(e.target.value)} required />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700' htmlFor='password'>密码</label>
            <input id='password' className='form-input w-full py-2' type='password' value={password} onChange={(e)=>setPassword(e.target.value)} required />
          </div>
        </div>
        <div className='mt-6'>
          <button disabled={isLoading} className='btn w-full bg-linear-to-t from-brand-primary-600 to-brand-primary-500 bg-[length:100%_100%] bg-[bottom] text-white shadow-sm hover:bg-[length:100%_150%] disabled:opacity-50'>
            {isLoading ? '登录中…' : '登录'}
          </button>
        </div>
      </form>
      <div className='mt-6 text-center'>
        <Link className='text-sm text-gray-700 underline hover:no-underline' href='/reset-password'>
          忘记密码
        </Link>
      </div>
    </>
  )
}
