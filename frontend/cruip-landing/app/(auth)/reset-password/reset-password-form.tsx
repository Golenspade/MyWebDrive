'use client'

import { type FormEvent, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function ResetPasswordForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent'>('idle')

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')

    window.setTimeout(() => {
      setStatus('sent')
    }, 350)
  }

  return (
    <>
      {status === 'sent' && (
        <div className='mb-6 rounded-[var(--nothing-r-sm)] border-l-[3px] border-nothing-display bg-nothing-raised p-3 text-sm text-nothing-primary'>
          如果该邮箱存在，我们会发送重置链接。请检查收件箱和垃圾邮件。
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className='space-y-5'>
          <div>
            <label className='label-nothing' htmlFor='email'>
              邮箱
            </label>
            <Input
              id='email'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='name@example.com'
              required
              className='border-0 border-b border-nothing-line-2 rounded-none bg-transparent px-0 pt-0 pb-3 focus-visible:border-nothing-display'
            />
          </div>
        </div>
        <div className='mt-8'>
          <Button type='submit' disabled={status === 'submitting'} className='h-11 w-full'>
            {status === 'submitting' ? '发送中...' : '发送重置链接'}
          </Button>
        </div>
      </form>
    </>
  )
}
