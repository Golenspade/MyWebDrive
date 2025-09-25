"use client";

export default function FeaturesGrid() {
  const items = [
    { title: "极速上传", desc: "多线程与断点续传，稳定可靠", icon: "⚡️" },
    { title: "安全加密", desc: "端到端加密与细粒度权限", icon: "🔐" },
    { title: "团队协作", desc: "邀请、分享、评论与版本历史", icon: "👥" },
    { title: "多端访问", desc: "桌面与移动端一致体验", icon: "📱" },
    { title: "高效检索", desc: "标签/全文/高级筛选", icon: "🔎" },
    { title: "可观测性", desc: "指标/日志/告警全链路", icon: "📈" },
  ];

  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl" data-aos="fade-up">核心特性</h2>
          <p className="mt-3 text-gray-600" data-aos="fade-up" data-aos-delay={100}>
            面向可靠与效率的云端文件协作体验
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <div
              key={i}
              className="group rounded-2xl bg-white p-6 ring-1 ring-gray-200 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
              data-aos="fade-up"
              data-aos-delay={100 + i * 50}
            >
              <div className="text-3xl">{it.icon}</div>
              <h3 className="mt-3 text-lg font-semibold">{it.title}</h3>
              <p className="mt-2 text-gray-600">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

