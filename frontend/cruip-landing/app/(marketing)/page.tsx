export const metadata = {
  title: "MyWebDrive - 云端文件存储与分享平台",
  description: "安全、高效的云端文件存储与分享解决方案，支持多用户权限管理和实时协作。",
};

// This file only exports the page component metadata and default component.
// If you need to share helpers, move them into a separate module instead of
// adding extra exports here.
import Hero from "@/components/hero-home";
import FeaturesGrid from "@/components/features-grid";
import Cta from "@/components/cta";

export default function Home() {
  return (
    <>
      <Hero />
      <FeaturesGrid />
      <Cta />
    </>
  );
}
