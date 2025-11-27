"use client";

/**
 * Call-to-Action Section
 * Original design by MyGO Studio for MyWebDrive
 * MIT License
 */
export default function Cta() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-center shadow-2xl">
          {/* Decorative gradient orbs */}
          <div
            className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-brand-primary-500/20 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-brand-accent-500/20 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 px-6 py-12 md:px-12 md:py-20">
            <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
              从此，写下属于你的故事
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-300">
              无需繁琐配置，一站式创作工具链助你快速实现创意
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                className="group inline-flex items-center justify-center rounded-lg bg-brand-primary-500 px-6 py-3 text-base font-medium text-white shadow-lg transition-all hover:bg-brand-primary-600 hover:shadow-xl"
                href="/download"
              >
                开始创作
                <span className="ml-2 transition-transform group-hover:translate-x-1">
                  →
                </span>
              </a>
              <a
                className="inline-flex items-center justify-center rounded-lg border border-gray-600 bg-transparent px-6 py-3 text-base font-medium text-gray-200 transition-all hover:border-gray-500 hover:bg-gray-800"
                href="/docs"
              >
                查看文档
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
