import Link from "next/link";
import Logo from "./logo";

export default function Footer({ border = false }: { border?: boolean }) {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Top area: Blocks */}
        <div
          className={`grid gap-10 py-8 sm:grid-cols-12 md:py-12 ${border ? "border-t border-nothing-line" : ""}`}
        >
          {/* 1st block */}
          <div className="space-y-2 sm:col-span-12 lg:col-span-4">
            <div>
              <Logo />
            </div>
            <div className="text-sm text-nothing-secondary">
              &copy; mygoavemujica.top && mygo.studio
            </div>
          </div>

          {/* 2nd block */}
          <div className="space-y-2 sm:col-span-6 md:col-span-3 lg:col-span-2">
            <h3 className="text-sm font-medium text-nothing-primary">资源</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  className="text-nothing-secondary transition-opacity duration-200 ease-in-out hover:opacity-80"
                  href="/download"
                >
                  软件
                </Link>
              </li>
              <li>
                <Link
                  className="text-nothing-secondary transition-opacity duration-200 ease-in-out hover:opacity-80"
                  href="/docs"
                >
                  教程
                </Link>
              </li>
              <li>
                <Link
                  className="text-nothing-secondary transition-opacity duration-200 ease-in-out hover:opacity-80"
                  href="/download?category=modelAsset"
                >
                  模型
                </Link>
              </li>
              <li>
                <Link
                  className="text-nothing-secondary transition-opacity duration-200 ease-in-out hover:opacity-80"
                  href="/article"
                >
                  评价
                </Link>
              </li>
            </ul>
          </div>

          {/* 3rd block */}
          <div className="space-y-2 sm:col-span-6 md:col-span-3 lg:col-span-2">
            <h3 className="text-sm font-medium text-nothing-primary">关于我们</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  className="text-nothing-secondary transition-opacity duration-200 ease-in-out hover:opacity-80"
                  href="/"
                >
                  本网站
                </Link>
              </li>
              <li>
                <Link
                  className="text-nothing-secondary transition-opacity duration-200 ease-in-out hover:opacity-80"
                  href="/docs"
                >
                  资源分发与作者条例
                </Link>
              </li>
              <li>
                <Link
                  className="text-nothing-secondary transition-opacity duration-200 ease-in-out hover:opacity-80"
                  href="/article"
                >
                  通知
                </Link>
              </li>
            </ul>
          </div>

          {/* 4th block */}
          <div className="space-y-2 sm:col-span-6 md:col-span-3 lg:col-span-2">
            <h3 className="text-sm font-medium text-nothing-primary">社区支持</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  className="text-nothing-secondary transition-opacity duration-200 ease-in-out hover:opacity-80"
                  href="/docs"
                >
                  使用条款
                </Link>
              </li>
              <li>
                <Link
                  className="text-nothing-secondary transition-opacity duration-200 ease-in-out hover:opacity-80"
                  href="/docs"
                >
                  报告问题
                </Link>
              </li>
            </ul>
          </div>

          {/* 5th block */}
          <div className="space-y-2 sm:col-span-6 md:col-span-3 lg:col-span-2">
            <h3 className="text-sm font-medium text-nothing-primary">社媒</h3>
            <ul className="flex gap-1">
              <li>
                <span
                  className="flex items-center justify-center text-nothing-secondary opacity-30"
                  aria-hidden="true"
                >
                  <svg
                    className="h-8 w-8 fill-current"
                    viewBox="0 0 32 32"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="m13.063 9 3.495 4.475L20.601 9h2.454l-5.359 5.931L24 23h-4.938l-3.866-4.893L10.771 23H8.316l5.735-6.342L8 9h5.063Zm-.74 1.347h-1.457l8.875 11.232h1.36l-8.778-11.232Z"></path>
                  </svg>
                </span>
              </li>
              <li>
                <span
                  className="flex items-center justify-center text-nothing-secondary opacity-30"
                  aria-hidden="true"
                >
                  <svg
                    className="h-8 w-8 fill-current"
                    viewBox="0 0 32 32"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M23 8H9a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1Zm-1.708 3.791-.858.823a.251.251 0 0 0-.1.241V18.9a.251.251 0 0 0 .1.241l.838.823v.181h-4.215v-.181l.868-.843c.085-.085.085-.11.085-.241v-4.887l-2.41 6.131h-.329l-2.81-6.13V18.1a.567.567 0 0 0 .156.472l1.129 1.37v.181h-3.2v-.181l1.129-1.37a.547.547 0 0 0 .146-.472v-4.749a.416.416 0 0 0-.138-.351l-1-1.209v-.181H13.8l2.4 5.283 2.122-5.283h2.971l-.001.181Z"></path>
                  </svg>
                </span>
              </li>
              <li>
                <a
                  className="flex items-center justify-center text-nothing-secondary transition-opacity duration-200 ease-in-out hover:opacity-80"
                  href="https://github.com"
                  aria-label="Github"
                  target="_blank"
                  rel="noreferrer"
                >
                  <svg
                    className="h-8 w-8 fill-current"
                    viewBox="0 0 32 32"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M16 8.2c-4.4 0-8 3.6-8 8 0 3.5 2.3 6.5 5.5 7.6.4.1.5-.2.5-.4V22c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3s1.4.1 2 .3c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.7 3.9.3.4.6.9.6 1.6v2.2c0 .2.1.5.6.4 3.2-1.1 5.5-4.1 5.5-7.6-.1-4.4-3.7-8-8.1-8z"></path>
                  </svg>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
