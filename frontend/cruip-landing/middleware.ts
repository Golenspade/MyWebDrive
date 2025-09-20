import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  // Normalize Chinese alias to ascii routes
  if (url.pathname === '/注册') {
    url.pathname = '/signup'
    return NextResponse.redirect(url)
  }
  if (url.pathname === '/登录') {
    url.pathname = '/signin'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/注册', '/登录']
}

