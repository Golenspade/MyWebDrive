import { cn } from "@/lib/utils"

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
  fluid?: boolean // 全宽布局，不使用 container 限宽
}

export function PageWrapper({ children, className, fluid = false }: PageWrapperProps) {
  return (
    <div
      className={cn(
        fluid ? 'w-full px-4 py-6' : 'container mx-auto px-4 py-6 max-w-7xl',
        className
      )}
    >
      {children}
    </div>
  )
}
