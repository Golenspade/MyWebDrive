"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AnimatedList } from "@/components/ui/animated-list";

export default function AnimatedListDemo({ className }: { className?: string }) {
  const items = React.useMemo(
    () => [
      { id: 1, text: "New message from Alex" },
      { id: 2, text: "File shared with you" },
      { id: 3, text: "Backup completed" },
      { id: 4, text: "Team mention in comments" },
    ],
    []
  );

  return (
    <div className={cn("w-full", className)}>
      <AnimatedList delay={900} className="items-start">
        {items.map((it) => (
          <div
            key={it.id}
            className="w-full rounded-md border bg-white/70 p-3 text-sm shadow-sm dark:bg-white/5"
          >
            {it.text}
          </div>
        ))}
      </AnimatedList>
    </div>
  );
}

