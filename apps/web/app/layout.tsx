import "./css/style.css";
import localFont from "next/font/local";

// Self-hosted fonts
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

export const metadata = {
  title: "MyWebDrive - 云端文件存储与分享平台",
  description: "安全、高效的云端文件存储与分享解决方案，支持多用户权限管理和实时协作。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="scroll-smooth">
      <body className={`${notoSansSC.variable} ${zcoolXiaoWei.variable} ${maShanZheng.variable} bg-gray-50 font-sans tracking-tight text-gray-900 antialiased`}>
        <div className="flex min-h-screen flex-col overflow-hidden supports-[overflow:clip]:overflow-clip">
          {children}
        </div>
      </body>
    </html>
  );
}
