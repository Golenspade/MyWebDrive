"use client";

import * as React from "react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { cn } from "@/lib/utils";

export default function AnimatedBeamMultipleOutputDemo({ className }: { className?: string }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const srcRef = React.useRef<HTMLDivElement | null>(null);
  const dst1Ref = React.useRef<HTMLDivElement | null>(null);
  const dst2Ref = React.useRef<HTMLDivElement | null>(null);
  const dst3Ref = React.useRef<HTMLDivElement | null>(null);

  return (
    <div ref={containerRef} className={cn("relative h-[300px] w-full", className)}>
      <div className="absolute inset-0 grid grid-cols-4 items-center gap-4 p-4">
        <div ref={srcRef} className="col-span-1 rounded-md border bg-white/70 p-3 text-sm shadow-sm dark:bg-white/5">
          Events
        </div>
        <div ref={dst1Ref} className="col-span-1 rounded-md border bg-white/70 p-3 text-sm shadow-sm dark:bg-white/5">
          Search
        </div>
        <div ref={dst2Ref} className="col-span-1 rounded-md border bg-white/70 p-3 text-sm shadow-sm dark:bg-white/5">
          Share
        </div>
        <div ref={dst3Ref} className="col-span-1 rounded-md border bg-white/70 p-3 text-sm shadow-sm dark:bg-white/5">
          Audit
        </div>
      </div>

      <AnimatedBeam containerRef={containerRef} fromRef={srcRef} toRef={dst1Ref} curvature={-40} />
      <AnimatedBeam containerRef={containerRef} fromRef={srcRef} toRef={dst2Ref} curvature={-20} delay={0.2} />
      <AnimatedBeam containerRef={containerRef} fromRef={srcRef} toRef={dst3Ref} curvature={-5} delay={0.4} />
    </div>
  );
}

