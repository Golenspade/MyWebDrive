export const metadata = {
  title: 'MyWebDrive',
  description: 'Next.js BFF dev server',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

