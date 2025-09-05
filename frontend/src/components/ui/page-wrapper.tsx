import { cn } from "@/lib/utils"

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
}

export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <div className={cn("container mx-auto px-4 py-6 max-w-7xl", className)}>
      {children}
    </div>
  )
}
