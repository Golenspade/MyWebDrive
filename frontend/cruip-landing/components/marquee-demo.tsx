"use client";

import { cn } from "@/lib/utils";
import { Marquee } from "@/components/ui/marquee";

// 上排 5 人（向左）
const firstRow = [
  { name: "高松灯", username: "高松灯", body: "大家的作品...好神奇", img: "/images/avatars/tomoriH.png" },
  { name: "千早爱音", username: "千早爱音", body: "略爱区，放过我吧", img: "/images/avatars/anonH.png" },
  { name: "长崎素世", username: "长崎素世", body: "我真的不是什么16岁离异寡妇", img: "/images/avatars/soyoH.png" },
  { name: "椎名立希", username: "椎名立希", body: "又来捣蛋了", img: "/images/avatars/takiH.png" },
  { name: "要乐奈", username: "要乐奈", body: "芭菲！爽！", img: "/images/avatars/ranaH.png" },
];

// 下排 5 人（向右）
const secondRow = [
  { name: "三角初华", username: "三角初华", body: "我的....小祥", img: "/images/avatars/uikaH.png" },
  { name: "丰川祥子", username: "丰川祥子", body: "为什么在每个世界里面我都要被女同缠住desuwa", img: "/images/avatars/sakiH.png" },
  { name: "八幡海铃", username: "八幡海铃", body: "我的信用差不多能够买下美国了", img: "/images/avatars/umiH.png" },
  { name: "祐天寺若麦", username: "祐天寺若麦", body: "关注喵梦亲喵，关注喵梦亲谢谢喵", img: "/images/avatars/nyamuH.png" },
  { name: "若叶睦", username: "若叶睦", body: "哇,还有futa", img: "/images/avatars/mzmH.png" },
];

function ReviewCard({
  img,
  name,
  username,
  body,
}: {
  img: string;
  name: string;
  username: string;
  body: string;
}) {
  return (
    <figure
      className={cn(
        "relative h-full w-64 cursor-pointer overflow-hidden rounded-xl border p-4",
        // light styles
        "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]",
        // dark styles
        "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]"
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <img className="rounded-full" width="32" height="32" alt="" src={img} />
        <div className="flex flex-col">
          <figcaption className="text-sm font-medium dark:text-white">
            {name}
          </figcaption>
          <p className="text-xs font-medium dark:text-white/40">{username}</p>
        </div>
      </div>
      <blockquote className="mt-2 text-sm">{body}</blockquote>
    </figure>
  );
}

export default function MarqueeDemo() {
  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
          <Marquee pauseOnHover className="[--duration:20s]">
            {firstRow.map((review) => (
              <ReviewCard key={review.username} {...review} />
            ))}
          </Marquee>
          <Marquee reverse pauseOnHover className="[--duration:20s]">
            {secondRow.map((review) => (
              <ReviewCard key={review.username} {...review} />
            ))}
          </Marquee>
          <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r"></div>
          <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l"></div>
        </div>
      </div>
    </section>
  );
}

