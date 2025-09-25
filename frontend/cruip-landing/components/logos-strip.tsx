"use client";

const logos = [
  { name: "Next.js" },
  { name: "React" },
  { name: "Tailwind" },
  { name: "AOS" },
  { name: "TypeScript" },
  { name: "Vercel" },
];

export default function LogosStrip() {
  return (
    <section className="relative py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 items-center gap-4 sm:grid-cols-3 md:grid-cols-6">
          {logos.map((l, i) => (
            <div
              key={i}
              className="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-500 shadow-sm transition hover:scale-[1.02] hover:text-gray-800"
              data-aos="zoom-in"
              data-aos-delay={50 + i * 30}
            >
              {l.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

