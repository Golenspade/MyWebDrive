"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// AOS scroll animations are disabled during the Nothing UI redesign to keep
// the interface static, monochrome and motion-minimal.
// import AOS from "aos";
// import "aos/dist/aos.css";

import Header from "@/components/ui/header";
import Footer from "@/components/ui/footer";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // AOS.init({
    //   once: true,
    //   disable: "phone",
    //   duration: 700,
    //   easing: "ease-out-cubic",
    // });
  });

  const pathname = usePathname();
  const hideChrome = pathname?.startsWith("/download");

  return (
    <>
      {!hideChrome && <Header />}

      <main className={hideChrome ? "" : "grow"}>{children}</main>

      {!hideChrome && <Footer border={true} />}
    </>
  );
}
