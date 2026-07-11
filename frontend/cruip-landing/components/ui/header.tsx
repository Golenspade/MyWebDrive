import Link from "next/link";
import Logo from "./logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Header() {
  return (
    <header className="fixed top-2 z-30 w-full md:top-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-3 rounded-[var(--nothing-r-md)] bg-nothing-glass px-3 backdrop-blur-[12px]">
          {/* Site branding */}
          <div className="flex flex-1 items-center">
            <Logo />
          </div>

          {/* Desktop actions */}
          <ul className="flex flex-1 items-center justify-end gap-3">
            <li className="hidden sm:block">
              <Button asChild variant="outline" size="sm">
                <Link href="/download">下载</Link>
              </Button>
            </li>
            <li>
              <ThemeToggle />
            </li>
            <li>
              <Button asChild variant="outline" size="sm">
                <Link href="/signin">登录</Link>
              </Button>
            </li>
            <li>
              <Button asChild variant="default" size="sm">
                <Link href="/signin">邮箱验证码注册</Link>
              </Button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
