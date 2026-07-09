"use client";

const icons = {
  bolt: (
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  lock: (
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  team: (
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  device: (
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  search: (
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  chart: (
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
};

export default function FeaturesGrid() {
  const items = [
    { title: "极速上传", desc: "多线程与断点续传，稳定可靠", icon: icons.bolt },
    { title: "安全加密", desc: "端到端加密与细粒度权限", icon: icons.lock },
    { title: "团队协作", desc: "邀请、分享、评论与版本历史", icon: icons.team },
    { title: "多端访问", desc: "桌面与移动端一致体验", icon: icons.device },
    { title: "高效检索", desc: "标签/全文/高级筛选", icon: icons.search },
    { title: "可观测性", desc: "指标/日志/告警全链路", icon: icons.chart },
  ];

  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-nothing-mono text-xs uppercase tracking-[0.1em] text-nothing-secondary">
            FEATURES
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-nothing-display sm:text-3xl">
            核心特性
          </h2>
          <p className="mt-3 text-nothing-secondary">
            面向可靠与效率的云端文件协作体验
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <article
              key={i}
              className="group rounded-[var(--nothing-r-md)] bg-nothing-glass p-6 backdrop-blur-[12px] transition-transform duration-200 ease-in-out hover:-translate-y-0.5"
            >
              <div className="text-nothing-secondary" aria-hidden="true">
                {it.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-nothing-display">
                {it.title}
              </h3>
              <p className="mt-2 text-sm text-nothing-secondary">{it.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
