"use client";

import Image from "next/image";
import PageIllustration from "@/components/page-illustration";
import SplitText from "@/components/SplitText";
import { ShimmerButton } from "@/components/ui/shimmer-button";
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
                  <div className="w-full grid grid-cols-5 items-stretch gap-2 sm:gap-3 md:gap-4 overflow-hidden rounded-xl">
                    {avatars.map((a, i) => (
                      <div key={i} className="relative h-24 sm:h-28 md:h-32 lg:h-36 overflow-hidden rounded-md">
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
            {(() => {
              const handleAnimationComplete = () => {
                // For now we only log to console in development when the hero
                // text animation completes. Use `console.warn` to respect the
                // shared ESLint configuration.
                if (process.env.NODE_ENV !== 'production') {
                  console.warn('All letters have animated!');
                }
              };
              return (
                <SplitText
                  text={"写下属于你的二创"}
                  className="mb-6 border-y text-5xl font-bold [border-image:linear-gradient(to_right,transparent,--theme(--color-slate-300/.8),transparent)1] md:text-6xl"
                  delay={100}
                  duration={0.6}
                  ease="power3.out"
                  splitType="chars"
                  from={{ opacity: 0, y: 40 }}
                  to={{ opacity: 1, y: 0 }}
                  threshold={0.1}
                  rootMargin="-100px"
                  textAlign="center"
                  tag="h1"
                  onLetterAnimationComplete={handleAnimationComplete}
                />
              );
            })()}
            <div className="mx-auto max-w-3xl">
              <SplitText
                text={"无需担心技术问题，mygo.studio为你提供一站式解决方案"}
                className="mb-8 text-lg text-gray-700"
                delay={70}
                duration={0.5}
                ease="power3.out"
                splitType="chars"
                from={{ opacity: 0, y: 40 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.28}
                rootMargin="-10px"
                textAlign="center"
                tag="p"
              />
              <div className="relative before:absolute before:inset-0 before:border-y before:[border-image:linear-gradient(to_right,transparent,--theme(--color-slate-300/.8),transparent)1]">
                <div
                  className="mx-auto max-w-xs sm:flex sm:max-w-none sm:justify-center"
                >
                  <ShimmerButton
                    className="mb-4 w-full sm:mb-0 sm:w-auto shadow-2xl"
                    onClick={() => window.location.assign('/download')}
                  >
                    <span className="relative inline-flex items-center text-white">
                      写下你的第一笔
                      <span className="ml-1 tracking-normal text-white/70 transition-transform group-hover:translate-x-0.5">
                        -&gt;
                      </span>
                    </span>
                  </ShimmerButton>
                  <a
                    className="btn w-full bg-white text-gray-800 shadow-sm hover:bg-gray-50 sm:ml-4 sm:w-auto"
                    href="#0"
                  >
                    了解更多
                  </a>
                </div>
              </div>
            </div>
          </div>
          {/* Hero image */}
          <div
            className="mx-auto max-w-3xl"
          >
            <div className="relative aspect-video rounded-2xl bg-gray-900 px-5 py-3 shadow-xl before:pointer-events-none before:absolute before:-inset-5 before:border-y before:[border-image:linear-gradient(to_right,transparent,--theme(--color-slate-300/.8),transparent)1] after:absolute after:-inset-5 after:-z-10 after:border-x after:[border-image:linear-gradient(to_bottom,transparent,--theme(--color-slate-300/.8),transparent)1]">
              <div className="relative mb-8 flex items-center justify-between before:block before:h-[9px] before:w-[41px] before:bg-[length:16px_9px] before:[background-image:radial-gradient(circle_at_4.5px_4.5px,var(--color-gray-600)_4.5px,transparent_0)] after:w-[41px]">
                <span className="text-[13px] font-medium text-white">
                  openwebgal.com
                </span>
              </div>
              <div className="font-mono text-gray-500 [&_span]:opacity-0">
                <span className="animate-[mwd-typewriter-1_10s_infinite] text-gray-200">Game_name: WebGAL;</span>
                <br />
                <span className="animate-[mwd-typewriter-2_10s_infinite]">Game_key: 0f33fdGr;</span>
                <br />
                <span className="animate-[mwd-typewriter-3_10s_infinite]">Title_img: Title.png;</span>
                <br />
                <span className="animate-[mwd-typewriter-4_10s_infinite]">Title_bgm: 夏影.mp3;</span>
                <br />
                <span className="animate-[mwd-typewriter-5_10s_infinite] text-gray-200">Game_Logo: WebGalEnter.png|bg.png;</span>
                <br />
                <span className="animate-[mwd-typewriter-6_10s_infinite]">Enable_Appreciation: true;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
