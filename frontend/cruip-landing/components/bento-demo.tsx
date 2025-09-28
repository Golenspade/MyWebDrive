"use client";

import { CalendarIcon, FileTextIcon } from "@radix-ui/react-icons";
import { BellIcon, Share2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import AnimatedBeamMultipleOutputDemo from "@/components/example/animated-beam-multiple-outputs";
import AnimatedListDemo from "@/components/example/animated-list-demo";
import { BentoCard, BentoGrid } from "@/components/magicui/bento-grid";
import { Marquee } from "@/components/magicui/marquee";

const files = [
  { name: "scence.txt", body: "爱音无语凝噎，毕竟一开始也是她提出要组件这个乐队." },
  { name: "soyohouse01.webp", body: "一间现代化的高层高端住在，内饰简约现代，阳光通过落地窗撒入室内，白天，无人，沙发，茶几，床." },
  { name: "model.json", body: "基于官方的motis而制作的改模，哥特式裙摆，华丽而不繁杂的设计，主色调：黑/暗红 无手套，有帽子，有附件，是否拼好模：是." },
  { name: "碧天伴走.mp3", body: "“疾走感”清爽摇滚：鼓点利落、贝斯有弹性，主歌略压抑，副歌抬升很爽" },
  { name: "fadein.json", body: "渐入效果，默认参数：100，参数范围：0-无限大" },
];

const features = [
  {
    Icon: FileTextIcon,
    name: "多样化的素材来源",
    description: "使用webgal的一切！",
    href: "#",
    cta: "Learn more",
    className: "col-span-3 lg:col-span-1",
    background: (
      <Marquee pauseOnHover className="absolute top-10 [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)] [--duration:20s]">
        {files.map((f, idx) => (
          <figure
            key={idx}
            className={cn(
              "relative w-32 cursor-pointer overflow-hidden rounded-xl border p-4",
              "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]",
              "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]",
              "transform-gpu blur-[1px] transition-all duration-300 ease-out hover:blur-none"
            )}
          >
            <div className="flex flex-row items-center gap-2">
              <div className="flex flex-col">
                <figcaption className="text-sm font-medium dark:text-white">{f.name}</figcaption>
              </div>
            </div>
            <blockquote className="mt-2 text-xs">{f.body}</blockquote>
          </figure>
        ))}
      </Marquee>
    ),
  },
  {
    Icon: BellIcon,
    name: "清晰的版本分发",
    description: "版本内容，更新特性，一目了然",
    href: "#",
    cta: "Learn more",
    className: "col-span-3 lg:col-span-2",
    background: (
      <AnimatedListDemo className="absolute top-4 right-2 h-[300px] w-full scale-75 border-none [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] transition-all duration-300 ease-out group-hover:scale-90" />
    ),
  },
  {
    Icon: Share2Icon,
    name: "分享 分发",
    description: "去到任何平台获得共鸣",
    href: "#",
    cta: "Learn more",
    className: "col-span-3 lg:col-span-2",
    background: (
      <AnimatedBeamMultipleOutputDemo className="absolute top-4 right-2 h-[300px] border-none [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] transition-all duration-300 ease-out group-hover:scale-105" />
    ),
  },
  {
    Icon: CalendarIcon,
    name: "更新提醒",
    description: "这倒是提醒我了，该写二创了",
    className: "col-span-3 lg:col-span-1",
    href: "#",
    cta: "Learn more",
    background: (
      <Calendar
        mode="single"
        selected={new Date(2022, 4, 11, 0, 0, 0)}
        className="absolute top-10 right-0 origin-top scale-75 rounded-md border [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)] transition-all duration-300 ease-out group-hover:scale-90"
      />
    ),
  },
];

export default function BentoDemo() {
  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl" data-aos="fade-up">核心特性</h2>
          <p className="mt-3 text-gray-600" data-aos="fade-up" data-aos-delay={100}>
            面向可靠与效率的云端文件协作体验
          </p>
        </div>
        <div className="mt-10 sm:mt-12" data-aos="fade-up" data-aos-delay={150}>
          <BentoGrid>
            {features.map((feature, idx) => (
              <BentoCard key={idx} {...(feature as any)} />
            ))}
          </BentoGrid>
        </div>
      </div>
    </section>
  );
}

