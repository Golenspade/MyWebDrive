'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Input } from '@/components/ui/input'

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
      // 根据角色跳转；默认用户跳到个人中心，管理员跳后台概览
      const nextRole = useAuthStore.getState().role
      if (nextRole === 'admin') router.push('/admin/overview')
      else router.push('/account')
    } catch (err: any) {
      setError(err?.message || '登录失败')
    }
  }

  // 避免在 render 中导航，使用 effect 监听状态
  useEffect(() => {
    if (!isAuthenticated) return
    if (role === 'admin') router.replace('/admin/overview')
    else router.replace('/account')
  }, [isAuthenticated, role, router])

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
            <Input id='email' type='email' value={email} onChange={(e)=>setEmail(e.target.value)} required placeholder='请输入邮箱' />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium text-gray-700' htmlFor='password'>密码</label>
            <Input id='password' type='password' value={password} onChange={(e)=>setPassword(e.target.value)} required placeholder='请输入密码' />
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
