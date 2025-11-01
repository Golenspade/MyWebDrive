"use client";

import { useEffect } from "react";

import AOS from "aos";
import "aos/dist/aos.css";

import Header from "@/components/ui/header";
import Footer from "@/components/ui/footer";
import { SmoothCursor } from "@/components/ui/smooth-cursor";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    AOS.init({
      once: true,
      duration: 700,
      easing: "ease-out-cubic",
    });
    // Ensure initial in-view elements animate immediately and run only once
    AOS.refreshHard();
  }, []);

  return (
    <div className="cursor-none">
      <SmoothCursor />
      <Header />

      <main className="grow">{children}</main>

      <Footer border={true} />
    </div>
  );
}
