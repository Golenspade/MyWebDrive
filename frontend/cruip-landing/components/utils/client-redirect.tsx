"use client";

import { useEffect } from "react";

export default function ClientRedirect({ to }: { to: string }) {
  useEffect(() => {
    if (to) {
      window.location.replace(to);
    }
  }, [to]);

  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="text-gray-600">
          正在跳转到下载仓库… 如果未跳转，请点击
          <a className="ml-1 text-blue-600 underline" href={to}>
            这里
          </a>
        </p>
      </div>
    </section>
  );
}

