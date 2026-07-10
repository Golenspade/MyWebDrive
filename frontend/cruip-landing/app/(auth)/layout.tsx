import Logo from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="absolute z-30 w-full">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between md:h-20">
            <div className="shrink-0">
              <Logo />
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative flex min-h-screen grow items-center justify-center bg-nothing-bg px-4 py-16 sm:px-6 lg:justify-start">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex h-full items-center">
            <div className="w-full max-w-sm">
              <div className="rounded-[var(--nothing-r-md)] bg-nothing-glass p-6 backdrop-blur-[12px] md:p-8">
                {children}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
