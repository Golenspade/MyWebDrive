export default function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:bg-neutral-900/70">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-neutral-600 dark:text-neutral-300 flex flex-col md:flex-row items-center gap-3 md:gap-6 md:justify-between">
        <div>
          © {year} MyWebDrive · MyGO Studio
        </div>
        <nav className="flex items-center gap-4">
          <a href="/admin/overview" className="hover:underline">后台</a>
          <a href="/docs" className="hover:underline">文档</a>
          <a href="https://github.com/Golenspade/MyWebDrive" target="_blank" rel="noreferrer" className="hover:underline">GitHub</a>
        </nav>
      </div>
    </footer>
  )
}

