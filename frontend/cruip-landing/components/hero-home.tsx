"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HeroHome() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero content */}
        <div className="pb-12 pt-32 md:pb-20 md:pt-40">
          {/* Section header */}
          <div className="pb-12 text-center md:pb-16">
            <p className="mb-4 font-nothing-mono text-xs uppercase tracking-[0.1em] text-nothing-secondary">
              MyWebDrive
            </p>
            <h1 className="mb-6 text-4xl font-semibold text-nothing-display md:text-5xl">
              安全存储，随时协作
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-nothing-secondary">
              无需担心技术问题，mygo.studio 为你提供一站式云端文件存储与分享解决方案。
            </p>
            <div className="mx-auto mt-8 max-w-xs sm:flex sm:max-w-none sm:justify-center">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/download" className="group">
                  写下你的第一笔
                  <span className="ml-1 tracking-normal text-nothing-primary/70 transition-transform duration-200 ease-in-out group-hover:translate-x-0.5">
                    -&gt;
                  </span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="mt-4 w-full sm:ml-4 sm:mt-0 sm:w-auto">
                <Link href="/docs">了解更多</Link>
              </Button>
            </div>
          </div>

          {/* Hero preview card */}
          <div className="mx-auto max-w-3xl">
            <div className="rounded-[var(--nothing-r-md)] bg-nothing-glass p-6 backdrop-blur-[12px] md:p-8">
              <div className="mb-6 flex items-center justify-between border-b border-nothing-line pb-4">
                <span className="font-nothing-mono text-xs uppercase tracking-[0.08em] text-nothing-secondary">
                  openwebgal.com
                </span>
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-nothing-line-2" />
                  <span className="h-3 w-3 rounded-full bg-nothing-line-2" />
                  <span className="h-3 w-3 rounded-full bg-nothing-line-2" />
                </div>
              </div>
              <div className="font-nothing-mono text-sm text-nothing-secondary">
                <p className="text-nothing-primary">Game_name: WebGAL;</p>
                <p>Game_key: 0f33fdGr;</p>
                <p>Title_img: Title.png;</p>
                <p>Title_bgm: 夏影.mp3;</p>
                <p className="text-nothing-primary">Game_Logo: WebGalEnter.png|bg.png;</p>
                <p>Enable_Appreciation: true;</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
