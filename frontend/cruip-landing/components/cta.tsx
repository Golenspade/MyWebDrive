import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Call-to-Action Section
 * Original design by MyGO Studio for MyWebDrive
 * MIT License
 */
export default function Cta() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-[var(--nothing-r-md)] bg-nothing-display px-4 py-12 text-center md:px-12 md:py-20">
          <p className="mb-4 font-nothing-mono text-xs uppercase tracking-[0.1em] text-nothing-bg/70">
            GET STARTED
          </p>
          <h2 className="mb-6 text-3xl font-semibold text-nothing-bg md:mb-12 md:text-4xl">
            从此，写下属于你的故事
          </h2>
          <p className="mx-auto mb-6 max-w-xl text-sm text-nothing-bg/70">
            使用邮箱验证码登录，首次验证成功即自动创建账户。
          </p>
          <div className="mx-auto max-w-xs sm:flex sm:max-w-none sm:justify-center">
            <Button
              asChild
              size="lg"
              className="w-full border-nothing-bg bg-nothing-bg text-nothing-display hover:bg-nothing-bg hover:text-nothing-display sm:w-auto"
            >
              <Link href="/signin" className="group">
                邮箱验证码登录 / 注册{" "}
                <span className="ml-1 tracking-normal text-nothing-secondary transition-transform duration-200 ease-in-out group-hover:translate-x-0.5">
                  -&gt;
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
