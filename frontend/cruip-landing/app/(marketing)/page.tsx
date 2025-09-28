export const metadata = {
  title: "MyWebDrive - 云端文件存储与分享平台",
  description: "安全、高效的云端文件存储与分享解决方案，支持多用户权限管理和实时协作。",
};

import Hero from "@/components/hero-home";
import BusinessCategories from "@/components/business-categories";

import Cta from "@/components/cta";

import BentoDemo from "@/components/bento-demo";
import { GlobeDemo } from "@/components/globe-demo";
import MarqueeDemo from "@/components/marquee-demo";

export default function Home() {
  return (
    <>
      <Hero />
      <BusinessCategories />
      <GlobeDemo />

      <BentoDemo />
      {/* LogosStrip removed per request */}

      <MarqueeDemo />
      <Cta />
    </>
  );
}
