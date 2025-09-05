import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { HardDrive } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((state) => state.login)
  
  // 获取从首页传递的状态信息
  const redirectMessage = location.state?.message
  const returnUrl = location.state?.returnUrl || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      await login(email, password)
      
      // 登录成功后的跳转逻辑
      const user = useAuthStore.getState().user
      
      // 如果有返回URL且不是登录页面，则跳转到返回URL
      if (returnUrl && returnUrl !== '/login' && returnUrl !== '/') {
        navigate(returnUrl)
      } else {
        // 否则根据用户角色跳转到默认页面
        if (user?.role === 'admin') {
          navigate('/dashboard')
        } else if (user?.role === 'user') {
          navigate('/files')
        } else if (user?.role === 'guest') {
          navigate('/files')
        } else {
          navigate('/')
        }
      }
    } catch (error) {
      // 错误已在store中处理
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary p-3 rounded-full">
              <HardDrive className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">欢迎回来</CardTitle>
          <CardDescription>
            {redirectMessage || '登录到 MyWebDrive'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱地址</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <Label htmlFor="remember" className="text-sm font-normal">
                  记住我
                </Label>
              </div>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                忘记密码？
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </form>

          {/* 演示账号提示（已种子：admin@local / admin123456）*/}
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-sm font-medium mb-2">演示账号：</p>
            <div className="text-xs space-y-1">
              <p><strong>管理员：</strong> admin@local / admin123456</p>
              <p><strong>普通用户：</strong> user@example.com / user123</p>
              <p><strong>游客：</strong> guest@example.com / guest123</p>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              <p><strong>权限说明：</strong></p>
              <p>• 游客：仅能浏览首页，下载需要注册</p>
              <p>• 用户：可下载和上传（最多3个slot）</p>
              <p>• 管理员：拥有所有权限</p>
            </div>
          </div>

          <div className="mt-6 text-center text-sm">
            还没有账号？{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              立即注册
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
