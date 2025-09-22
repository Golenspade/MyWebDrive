import ClientRedirect from "@/components/utils/client-redirect";
export const dynamic = 'force-static'
const REPO_RELEASES = 'https://github.com/Golenspade/MyWebDrive/releases';
const REDIRECT_URL = process.env.NEXT_PUBLIC_DOWNLOAD_REDIRECT_URL as string | undefined;

const items = [
  {
    key: 'mac',
    name: 'macOS (Apple Silicon / Intel)',
    version: 'v0.1.0',
    notes: '通用安装包，首次体验推荐',
    size: '78 MB',
    icon: (
      <svg className="h-6 w-6 fill-blue-500" viewBox="0 0 24 24" aria-hidden>
        <path d="M16.365 1.43c0 1.14-.42 2.02-1.26 2.73-.84.68-1.74 1.03-2.7.99-.1-1.1.34-2.06 1.26-2.79.92-.77 1.94-1.17 2.97-1.2.03.09.03.18.03.27zM20.97 17.06c-.52 1.26-1.16 2.36-1.92 3.3-.9 1.11-1.84 1.67-2.82 1.67-.67 0-1.48-.2-2.43-.59-.96-.39-1.84-.59-2.64-.59-.82 0-1.72.2-2.7.59-.98.39-1.77.6-2.37.6-1.06 0-2.05-.58-2.97-1.73-.92-1.11-1.69-2.46-2.31-4.05C.3 14.8 0 13.27 0 11.84c0-1.52.35-2.83 1.05-3.93.52-.86 1.22-1.54 2.1-2.01.88-.48 1.82-.72 2.82-.74.55 0 1.27.21 2.16.62.89.41 1.47.62 1.74.62.21 0 .84-.24 1.92-.72 1.03-.41 1.9-.61 2.61-.62 1.97.06 3.46.76 4.47 2.1-1.78 1.08-2.66 2.6-2.64 4.56.02 1.52.57 2.79 1.65 3.78.49.46 1.04.82 1.65 1.08-.13.4-.28.77-.45 1.12z"/>
      </svg>
    ),
    actions: [
      { label: '下载 .dmg', href: REPO_RELEASES, primary: true },
      { label: '历史版本', href: REPO_RELEASES, primary: false },
    ],
  },
  {
    key: 'win',
    name: 'Windows (x64)',
    version: 'v0.1.0',
    notes: '支持 10/11，带签名安装程序',
    size: '85 MB',
    icon: (
      <svg className="h-6 w-6 fill-blue-500" viewBox="0 0 24 24" aria-hidden>
        <path d="M1 3.5l9-1.5v9l-9 .5v-8zM11 2l12-2v11l-12 .8v-9.8zM1 12.5l9-.5v9l-9-1.5v-7zM11 12.2l12-.7v11.5l-12-2v-8.8z"/>
      </svg>
    ),
    actions: [
      { label: '下载 .exe', href: REPO_RELEASES, primary: true },
      { label: '历史版本', href: REPO_RELEASES, primary: false },
    ],
  },
  {
    key: 'linux',
    name: 'Linux (x64 / ARM64)',
    version: 'v0.1.0',
    notes: 'AppImage / tar.gz 通用包',
    size: '72 MB',
    icon: (
      <svg className="h-6 w-6 fill-blue-500" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2c2.2 0 3.9 1.8 3.9 4 0 1.4-.7 2.6-1.8 3.3.4.6.9 1.4 1.4 2.4.6 1.1 1.1 1.9 1.5 2.5.6.9.9 1.6.9 2.1 0 .6-.2 1.1-.7 1.5-.4.4-.9.6-1.5.6-.5 0-1.1-.2-1.6-.6-.3-.2-.7-.6-1.3-1.1-.6.5-1.1.9-1.4 1.1-.5.4-1.1.6-1.6.6-.6 0-1.1-.2-1.5-.6-.4-.4-.7-.9-.7-1.5 0-.5.3-1.2.9-2.1.4-.6.9-1.4 1.5-2.5.5-.9 1-1.7 1.4-2.4-1.1-.7-1.8-1.9-1.8-3.3 0-2.2 1.8-4 4-4z"/>
      </svg>
    ),
    actions: [
      { label: '下载 .AppImage', href: REPO_RELEASES, primary: true },
      { label: '历史版本', href: REPO_RELEASES, primary: false },
    ],
  },
]

export default function DownloadPage() {
  if (REDIRECT_URL) {
    return <ClientRedirect to={REDIRECT_URL} />
  }
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold md:text-4xl">下载 MyWebDrive 客户端</h1>
          <p className="mt-3 text-gray-600">为你的平台选择合适的安装包。以下链接为演示占位，确认样式后我再接入真实地址。</p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <article key={it.key} className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-transparent before:[background:linear-gradient(var(--color-gray-100),var(--color-gray-200))_border-box] before:[mask-composite:exclude_!important] before:[mask:linear-gradient(white_0_0)_padding-box,_linear-gradient(white_0_0)]">
              <div className="flex items-center gap-3">
                {it.icon}
                <h3 className="text-lg font-semibold text-gray-900">{it.name}</h3>
              </div>
              <div className="mt-3 text-sm text-gray-500">{it.notes}</div>
              <div className="mt-2 text-sm text-gray-400">最新版本：{it.version} · {it.size}</div>
              <div className="mt-5 flex gap-3">
                {it.actions.map(a => (
                  <a
                    key={a.label}
                    href={a.href}
                    className={
                      "btn-sm shadow-sm " +
                      (a.primary
                        ? "bg-gray-900 text-gray-100 hover:bg-gray-800"
                        : "bg-white text-gray-800 hover:bg-gray-50 border border-gray-200")
                    }
                  >
                    {a.label}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          <p className="font-medium text-gray-900">说明</p>
          <ul className="mt-2 list-disc pl-5">
            <li>这是样式接入预览，真实下载链接和版本信息可对接到后端或静态 JSON。</li>
            <li>可支持平台自动识别、历史版本切换、校验和展示、镜像下载等。</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
