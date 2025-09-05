import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, PlusCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageWrapper } from "@/components/ui/page-wrapper"
import { PageHeader } from "@/components/ui/page-header"
import { DataTable } from "@/components/ui/data-table"
import { Badge } from "@/components/ui/badge"

// 用户数据类型
export type User = {
  id: string
  name: string
  email: string
  role: "admin" | "user"
  status: "active" | "inactive"
  createdAt: string
  storageUsed: number
  storageQuota: number
}

// 模拟数据
const users: User[] = [
  {
    id: "1",
    name: "张三",
    email: "zhangsan@example.com",
    role: "admin",
    status: "active",
    createdAt: "2024-01-15",
    storageUsed: 2048000000, // 2GB
    storageQuota: 10737418240, // 10GB
  },
  {
    id: "2",
    name: "李四",
    email: "lisi@example.com",
    role: "user",
    status: "active",
    createdAt: "2024-01-20",
    storageUsed: 5368709120, // 5GB
    storageQuota: 5368709120, // 5GB
  },
  {
    id: "3",
    name: "王五",
    email: "wangwu@example.com",
    role: "user",
    status: "inactive",
    createdAt: "2024-01-25",
    storageUsed: 1073741824, // 1GB
    storageQuota: 5368709120, // 5GB
  },
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// 表格列定义
export const columns: ColumnDef<User>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          姓名
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
  },
  {
    accessorKey: "email",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          邮箱
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => <div className="lowercase">{row.getValue("email")}</div>,
  },
  {
    accessorKey: "role",
    header: "角色",
    cell: ({ row }) => {
      const role = row.getValue("role") as string
      return (
        <Badge variant={role === "admin" ? "default" : "secondary"}>
          {role === "admin" ? "管理员" : "用户"}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: "状态",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge variant={status === "active" ? "default" : "secondary"}>
          {status === "active" ? "活跃" : "非活跃"}
        </Badge>
      )
    },
  },
  {
    accessorKey: "storageUsed",
    header: "存储使用",
    cell: ({ row }) => {
      const used = row.getValue("storageUsed") as number
      const quota = row.original.storageQuota
      const percentage = Math.round((used / quota) * 100)
      return (
        <div className="text-right">
          <div className="text-sm font-medium">{formatBytes(used)}</div>
          <div className="text-xs text-muted-foreground">
            {percentage}% of {formatBytes(quota)}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          创建时间
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("createdAt"))
      return <div>{date.toLocaleDateString()}</div>
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const user = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>操作</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(user.id)}
            >
              复制用户ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>查看详情</DropdownMenuItem>
            <DropdownMenuItem>编辑用户</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              删除用户
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export default function UsersPage() {
  const navigate = useNavigate()

  return (
    <PageWrapper>
      <PageHeader
        title="用户管理"
        description="管理您应用中的所有用户。"
      >
        <Button onClick={() => navigate('/users/new')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          添加用户
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={users}
        searchKey="name"
      />
    </PageWrapper>
  )
}
