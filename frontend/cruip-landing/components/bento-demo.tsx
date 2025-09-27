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
  { name: "bitcoin.pdf", body: "Bitcoin is a cryptocurrency invented in 2008 by an unknown person or group of people using the name Satoshi Nakamoto." },
  { name: "finances.xlsx", body: "A spreadsheet or worksheet is a file made of rows and columns that help sort data, arrange data easily, and calculate numerical data." },
  { name: "logo.svg", body: "Scalable Vector Graphics is an Extensible Markup Language-based vector image format for two-dimensional graphics with support for interactivity and animation." },
  { name: "keys.gpg", body: "GPG keys are used to encrypt and decrypt email, files, directories, and whole disk partitions and to authenticate messages." },
  { name: "seed.txt", body: "A seed phrase, seed recovery phrase or backup seed phrase is a list of words which store all the information needed to recover Bitcoin funds on-chain." },
];

const features = [
  {
    Icon: FileTextIcon,
    name: "实时保存",
    description: "实时保存 我，无畏闪退！",
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
    name: "自动推送",
    description: "自动的更新发行版",
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
    name: "写作日期",
    description: "使用日历管理创作",
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

