import { useAuthStore } from '@/stores/authStore'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'


export default function DebugPage() {
  const { user, isAuthenticated } = useAuthStore()




  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>调试面板</CardTitle>
          <CardDescription>
            用于测试和调试认证状态
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">当前认证状态:</h3>
            <p className="text-sm text-muted-foreground">
              已认证: {isAuthenticated ? '是' : '否'}
            </p>
            {user && (
              <div className="text-sm text-muted-foreground mt-2">
                <p>用户: {user.name}</p>
                <p>邮箱: {user.email}</p>
                <p>角色: {user.role}</p>
              </div>
            )}
          </div>
          

        </CardContent>
      </Card>
    </div>
  )
}
