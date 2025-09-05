import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/hooks/use-toast'
import { downloadFileById, handleDownloadPermission } from '@/lib/downloadUtils'
import { 
  Download, 
  Upload, 
  Shield, 
  Users, 
  FileText, 
  Star,
  Play,
  ArrowRight,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// 模拟的展示文件数据
const DEMO_FILES = [
  {
    id: '1',
    name: '项目演示视频.mp4',
    size: '125.6 MB',
    type: 'video',
    category: '演示资料',
    featured: true,
    description: '完整的项目功能演示，包含所有核心特性介绍'
  },
  {
    id: '2',
    name: '用户手册.pdf',
    size: '8.2 MB',
    type: 'document',
    category: '文档',
    featured: true,
    description: '详细的用户操作指南和常见问题解答'
  },
  {
    id: '3',
    name: '系统架构图.png',
    size: '2.1 MB',
    type: 'image',
    category: '技术文档',
    featured: false,
    description: '完整的系统架构设计图'
  },
  {
    id: '4',
    name: '数据库设计.sql',
    size: '15.3 KB',
    type: 'code',
    category: '开发资源',
    featured: false,
    description: '数据库表结构和初始化脚本'
  },
  {
    id: '5',
    name: 'API接口文档.md',
    size: '45.7 KB',
    type: 'document',
    category: '开发资源',
    featured: true,
    description: '完整的API接口说明和调用示例'
  },
  {
    id: '6',
    name: '安装包v1.0.zip',
    size: '89.4 MB',
    type: 'archive',
    category: '软件包',
    featured: true,
    description: '最新版本的完整安装包'
  }
]

const FEATURES = [
  {
    icon: Shield,
    title: '安全可靠',
    description: '企业级安全保障，数据加密传输和存储'
  },
  {
    icon: Users,
    title: '多用户支持',
    description: '支持管理员、用户、游客等多种角色权限管理'
  },
  {
    icon: Upload,
    title: '便捷上传',
    description: '支持拖拽上传，批量上传，断点续传'
  },
  {
    icon: Download,
    title: '高速下载',
    description: '多线程下载，支持断点续传，下载速度优化'
  }
]

export default function HomePage() {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const user = useAuthStore((state) => state.user)
  const { clearAuth } = useAuthStore()
  const { toast } = useToast()

  const categories = ['全部', '演示资料', '文档', '技术文档', '开发资源', '软件包']
  
  const filteredFiles = selectedCategory === '全部' 
    ? DEMO_FILES 
    : DEMO_FILES.filter(file => file.category === selectedCategory)

  const handleDownload = async (file: { id: string; name: string }) => {
    console.warn('=== 下载按钮点击 ===')
    console.warn('文件:', file)
    console.warn('当前用户:', user)

    try {
      // 检查权限
      if (!handleDownloadPermission(user, navigate, file.id, '/')) {
        return
      }

      // 执行下载逻辑
      console.warn('开始下载文件:', file)
      await downloadFileById(file.id, file.name)
    } catch (error) {
      console.error('下载处理出错:', error)
    }
  }

  const handleUpload = () => {
    if (!user) {
      navigate('/login')
      return
    }

    if (user.role === 'guest') {
      toast({
        title: "上传受限",
        description: "游客无法上传文件，请注册成为用户",
        variant: "destructive"
      })
      return
    }

    // 跳转到文件页面
    navigate('/files')
  }

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'video':
        return Play
      case 'document':
        return FileText
      case 'image':
        return FileText
      case 'code':
        return FileText
      case 'archive':
        return FileText
      default:
        return FileText
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
      {/* 顶部导航 */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-primary p-2 rounded-lg">
              <FileText className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">MyWebDrive</span>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">
                  欢迎, {user.name} ({user.role})
                </span>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    clearAuth()
                    toast({ title: "已退出登录", description: "现在可以测试未登录功能" })
                  }}
                >
                  退出登录(测试)
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/login')}>
                  登录
                </Button>
                <Button onClick={() => navigate('/register')}>
                  注册
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 英雄区域 */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            云端文件存储
            <span className="text-primary"> 简单高效</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            安全可靠的云存储平台，支持多用户协作，提供企业级的文件管理解决方案
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleUpload} className="text-lg px-8 py-3">
              <Upload className="mr-2 w-5 h-5" />
              开始上传
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
              立即登录
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            {/* 开发环境调试按钮 */}
            {process.env.NODE_ENV === 'development' && (
              <>
                <Button size="sm" variant="destructive" onClick={() => {
                  console.warn('=== 强制跳转测试 ===')
                  console.warn('使用 window.location.href 跳转到 /login')
                  window.location.href = '/login'
                }}>
                  强制跳转测试
                </Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  console.warn('=== 使用 window.history.pushState 测试 ===')
                  window.history.pushState(null, '', '/login')
                  console.warn('URL 已更改，但需要重新渲染')
                  window.location.reload()
                }}>
                  History API测试
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 功能特性 */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">为什么选择我们</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={index} className="text-center">
                  <CardHeader>
                    <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* 文件展示区域 */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">资源展示</h2>
            <p className="text-lg text-muted-foreground">
              浏览我们的精选资源，注册用户可以下载和上传文件
            </p>
          </div>

          {/* 分类筛选 */}
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className="rounded-full"
              >
                {category}
              </Button>
            ))}
          </div>

          {/* 推荐文件 */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-6 flex items-center">
              <Star className="w-6 h-6 text-yellow-500 mr-2" />
              推荐资源
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {DEMO_FILES.filter(file => file.featured).map((file) => {
                const Icon = getFileIcon(file.type)
                return (
                  <Card key={file.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="bg-primary/10 p-2 rounded-lg">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{file.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{file.size}</p>
                          </div>
                        </div>
                        <Badge variant="secondary">{file.category}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-4">
                        {file.description}
                      </CardDescription>
                      <Button 
                        onClick={() => handleDownload(file)} 
                        className="w-full"
                      >
                        <Download className="mr-2 w-4 h-4" />
                        下载文件
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* 所有文件 */}
          <div>
            <h3 className="text-2xl font-semibold mb-6">所有资源</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFiles.map((file) => {
                const Icon = getFileIcon(file.type)
                return (
                  <Card key={file.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="bg-muted p-2 rounded-lg">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{file.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{file.size}</p>
                          </div>
                        </div>
                        <Badge variant="outline">{file.category}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-4">
                        {file.description}
                      </CardDescription>
                      <Button 
                        onClick={() => handleDownload(file)} 
                        variant="outline" 
                        className="w-full"
                      >
                        <Download className="mr-2 w-4 h-4" />
                        下载文件
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 用户类型说明 */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">用户权限说明</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-red-600" />
                </div>
                <CardTitle className="text-xl text-red-600">游客</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-left">
                  <li className="flex items-center">
                    <Check className="w-4 h-4 text-green-500 mr-2" />
                    浏览首页资源
                  </li>
                  <li className="flex items-center text-muted-foreground">
                    <span className="w-4 h-4 mr-2">✕</span>
                    下载文件（需要注册）
                  </li>
                  <li className="flex items-center text-muted-foreground">
                    <span className="w-4 h-4 mr-2">✕</span>
                    上传文件
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="text-center border-primary">
              <CardHeader>
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl text-blue-600">注册用户</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-left">
                  <li className="flex items-center">
                    <Check className="w-4 h-4 text-green-500 mr-2" />
                    下载所有文件
                  </li>
                  <li className="flex items-center">
                    <Check className="w-4 h-4 text-green-500 mr-2" />
                    上传文件（最多3个slot）
                  </li>
                  <li className="flex items-center">
                    <Check className="w-4 h-4 text-green-500 mr-2" />
                    文件管理
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-xl text-green-600">管理员</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-left">
                  <li className="flex items-center">
                    <Check className="w-4 h-4 text-green-500 mr-2" />
                    所有用户权限
                  </li>
                  <li className="flex items-center">
                    <Check className="w-4 h-4 text-green-500 mr-2" />
                    用户管理
                  </li>
                  <li className="flex items-center">
                    <Check className="w-4 h-4 text-green-500 mr-2" />
                    上传审核管理
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 底部 */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 MyWebDrive. 保留所有权利.</p>
        </div>
      </footer>
    </div>
  )
}
