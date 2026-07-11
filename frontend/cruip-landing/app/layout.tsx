import "./css/style.css";
import localFont from "next/font/local";

// Self-hosted Chinese fonts (existing)
const notoSansSC = localFont({
  src: [
    { path: "../public/fonts/noto-sans-sc-v39-chinese-simplified_latin-regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/noto-sans-sc-v39-chinese-simplified_latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

const zcoolXiaoWei = localFont({
  src: "../public/fonts/zcool-xiaowei-v15-chinese-simplified_latin-regular.woff2",
  variable: "--font-heading",
  display: "swap",
});

const maShanZheng = localFont({
  src: "../public/fonts/ma-shan-zheng-v14-latin-regular.woff2",
  variable: "--font-handwrite",
  display: "swap",
});

// Nothing UI fonts (SIL OFL 1.1)
const doto = localFont({
  src: "../public/fonts/open/Doto-ROND-wght.ttf",
  variable: "--font-doto",
  display: "swap",
});

const geist = localFont({
  src: [
    { path: "../public/fonts/open/Geist-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/open/Geist-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = localFont({
  src: [
    { path: "../public/fonts/open/GeistMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/open/GeistMono-Medium.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});

const newsreader = localFont({
  src: "../public/fonts/open/Newsreader-Italic.ttf",
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata = {
  title: "MyWebDrive - 云端文件存储与分享平台",
  description: "安全、高效的云端文件存储与分享解决方案，支持多用户权限管理和实时协作。",
} as const;

// Keep this file exporting only metadata + the default RootLayout component.
// Shared helpers or constants should live in separate modules to keep Fast
// Refresh working as expected.

import { ThemeProvider } from "@/components/theme-provider";
import { AuthBootstrap } from "@/components/auth-bootstrap";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <body
        className={`${notoSansSC.variable} ${zcoolXiaoWei.variable} ${maShanZheng.variable} ${doto.variable} ${geist.variable} ${geistMono.variable} ${newsreader.variable} bg-nothing-bg text-nothing-primary font-sans antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthBootstrap />
          <div className="flex min-h-screen flex-col">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
