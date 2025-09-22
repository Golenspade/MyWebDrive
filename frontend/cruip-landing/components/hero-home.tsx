import Image from "next/image";
import PageIllustration from "@/components/page-illustration";
// Custom avatars from public/images/avatars (place files anon.png, soyo.png, tomori.png, taki.png, rana.png)

export default function HeroHome() {
  return (
    <section className="relative">
      <PageIllustration />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero content */}
        <div className="pb-12 pt-32 md:pb-20 md:pt-40">
          {/* Section header */}
          <div className="pb-12 text-center md:pb-16">
            <div
              className="mb-6 border-y [border-image:linear-gradient(to_right,transparent,--theme(--color-slate-300/.8),transparent)1]"
              data-aos="zoom-y-out"
            >
              {(() => {
                const avatars = [
                  { src: "/images/anon.png", alt: "anon", opacity: "opacity-70" },
                  { src: "/images/soyo.png", alt: "soyo", opacity: "opacity-90" },
                  { src: "/images/tomori.png", alt: "tomori", opacity: "opacity-100" },
                  { src: "/images/taki.png", alt: "taki", opacity: "opacity-90" },
                  { src: "/images/rana.png", alt: "rana", opacity: "opacity-70" },
                ];
                return (
                  <div className="w-full grid grid-cols-5 items-stretch gap-2 sm:gap-3 md:gap-4 overflow-hidden [--corner:28px]
                  [mask-image:linear-gradient(black,black),radial-gradient(circle_at_0%_100%,black_calc(var(--corner)+8px),transparent_calc(var(--corner)+16px)),radial-gradient(circle_at_100%_100%,black_calc(var(--corner)+8px),transparent_calc(var(--corner)+16px))]
                  [-webkit-mask-image:linear-gradient(black,black),radial-gradient(circle_at_0%_100%,black_calc(var(--corner)+8px),transparent_calc(var(--corner)+16px)),radial-gradient(circle_at_100%_100%,black_calc(var(--corner)+8px),transparent_calc(var(--corner)+16px))]
                  [-webkit-mask-composite:source-over,destination-out,destination-out]
                  [mask-composite:subtract]">
                    {avatars.map((a, i) => (
                      <div key={i} className="relative h-28 sm:h-36 md:h-44 lg:h-56">
                        <Image
                          src={a.src}
                          alt={a.alt}
                          fill
                          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 18vw, 20vw"
                          className={`object-contain border-2 border-white/80 shadow-sm ${a.opacity}`}
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <h1
              className="mb-6 border-y text-5xl font-bold [border-image:linear-gradient(to_right,transparent,--theme(--color-slate-300/.8),transparent)1] md:text-6xl"
              data-aos="zoom-y-out"
              data-aos-delay={150}
            >
              The website builder you're <br className="max-lg:hidden" />
              looking for
            </h1>
            <div className="mx-auto max-w-3xl">
              <p
                className="mb-8 text-lg text-gray-700"
                data-aos="zoom-y-out"
                data-aos-delay={300}
              >
                Simple is a modern website builder powered by AI that changes
                how companies create user interfaces together.
              </p>
              <div className="relative before:absolute before:inset-0 before:border-y before:[border-image:linear-gradient(to_right,transparent,--theme(--color-slate-300/.8),transparent)1]">
                <div
                  className="mx-auto max-w-xs sm:flex sm:max-w-none sm:justify-center"
                  data-aos="zoom-y-out"
                  data-aos-delay={450}
                >
                  <a
                    className="btn group mb-4 w-full bg-linear-to-t from-brand-primary-600 to-brand-primary-500 bg-[length:100%_100%] bg-[bottom] text-white shadow-sm hover:bg-[length:100%_150%] sm:mb-0 sm:w-auto"
                    href="#0"
                  >
                    <span className="relative inline-flex items-center">
                      Start Free Trial{" "}
                      <span className="ml-1 tracking-normal text-brand-primary-300 transition-transform group-hover:translate-x-0.5">
                        -&gt;
                      </span>
                    </span>
                  </a>
                  <a
                    className="btn w-full bg-white text-gray-800 shadow-sm hover:bg-gray-50 sm:ml-4 sm:w-auto"
                    href="#0"
                  >
                    Learn More
                  </a>
                </div>
              </div>
            </div>
          </div>
          {/* Hero image */}
          <div
            className="mx-auto max-w-3xl"
            data-aos="zoom-y-out"
            data-aos-delay={600}
          >
            <div className="relative aspect-video rounded-2xl bg-gray-900 px-5 py-3 shadow-xl before:pointer-events-none before:absolute before:-inset-5 before:border-y before:[border-image:linear-gradient(to_right,transparent,--theme(--color-slate-300/.8),transparent)1] after:absolute after:-inset-5 after:-z-10 after:border-x after:[border-image:linear-gradient(to_bottom,transparent,--theme(--color-slate-300/.8),transparent)1]">
              <div className="relative mb-8 flex items-center justify-between before:block before:h-[9px] before:w-[41px] before:bg-[length:16px_9px] before:[background-image:radial-gradient(circle_at_4.5px_4.5px,var(--color-gray-600)_4.5px,transparent_0)] after:w-[41px]">
                <span className="text-[13px] font-medium text-white">
                  openwebgal.com
                </span>
              </div>
              <div className="font-mono text-gray-500 [&_span]:opacity-0">
                <span className="animate-[code-1_10s_infinite] text-gray-200">Game_name: WebGAL;</span>
                <br />
                <span className="animate-[code-2_10s_infinite]">Game_key: 0f33fdGr;</span>
                <br />
                <span className="animate-[code-3_10s_infinite]">Title_img: Title.png;</span>
                <br />
                <span className="animate-[code-4_10s_infinite]">Title_bgm: 夏影.mp3;</span>
                <br />
                <span className="animate-[code-5_10s_infinite] text-gray-200">Game_Logo: WebGalEnter.png|bg.png;</span>
                <br />
                <span className="animate-[code-6_10s_infinite]">Enable_Appreciation: true;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
