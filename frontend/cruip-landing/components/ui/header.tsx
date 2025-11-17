import Link from "next/link";
import Logo from "./logo";
import ShinyText from "@/components/ShinyText";

export default function Header() {
  return (
    <header className="fixed top-2 z-30 w-full md:top-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative flex h-14 items-center justify-between gap-3 rounded-2xl bg-white/90 px-3 shadow-lg shadow-black/[0.03] backdrop-blur-xs ring-1 ring-gray-200/80">
          {/* Site branding */}
          <div className="flex flex-1 items-center">
            <Logo />
          </div>

          {/* Desktop sign in links */}
          <ul className="flex flex-1 items-center justify-end gap-3">
            <li>
              <Link href="/download" className="btn-sm bg-white text-gray-800 shadow-sm hover:bg-gray-50">
                <ShinyText text="下载" speed={3} />
              </Link>
            </li>

            <li>
              <Link
                href="/login"
                className="btn-sm bg-white text-gray-800 shadow-sm hover:bg-gray-50"
              >
                <ShinyText text="登录" speed={3} />
              </Link>
            </li>
            <li>
              <Link
                href="/register"
                className="btn-sm bg-gray-800 text-gray-200 shadow-sm hover:bg-gray-900"
              >
                <ShinyText text="注册" speed={3} />
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
