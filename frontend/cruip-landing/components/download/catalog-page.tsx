"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import Footer from "@/components/ui/footer";
import { Copy, Download, Github, Layers3, Search, Settings2, Terminal, ExternalLink, Apple, Monitor, Cpu, ShieldCheck, Package2 } from "lucide-react";

export default function AppCatalogPage() {
  const [q, setQ] = useState("");
  const [os, setOs] = useState<OS | "all">("all");
  const [arch, setArch] = useState<Arch | "all">("all");
  const [channel, setChannel] = useState<Channel>("stable");
  const [category, setCategory] = useState<Category | "all">("all");
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const { toast } = useToast?.() ?? { toast: () => {} };

  const [projects, setProjects] = useState<Project[]>([]);
  const data = useMemo(() => (projects && projects.length ? projects : SAMPLE_PROJECTS), [projects]);

  useEffect(() => {
    setOs(detectOS());
  }, []);
  useEffect(() => {
    fetch('/api/v1/catalog')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('catalog fetch failed')))
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    const cat = searchParams?.get("category");
    const cats = ["all","base","writing","model","script","bundle","modelAsset","article"] as const;
    if (cat && (cats as readonly string[]).includes(cat)) setCategory(cat as Category | "all");
  }, [searchParams]);

  const filtered = useMemo(() => {
    return data.filter(p => {
      const matchQ = q ? (p.name.toLowerCase().includes(q.toLowerCase()) || (p.description?.toLowerCase() ?? "").includes(q.toLowerCase())) : true;
      const matchCat = category === "all" ? true : p.category === category;
      const matchAsset = p.releases.some(r =>
        r.channel === channel &&
        r.assets.some(a =>
          (os === "all" || !a.os || a.os === "any" || a.os === os) &&
          (arch === "all" || !a.arch || a.arch === "any" || a.arch === arch)
        )
      );
      return matchQ && matchCat && matchAsset;
    });
  }, [data, q, os, arch, channel, category]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-nothing-bg text-nothing-primary">
        <HeaderBar />
        <HeroBar />
        <div className="mx-auto max-w-7xl px-4 pb-24">
          <FilterBar q={q} setQ={setQ} os={os} setOs={setOs} arch={arch} setArch={setArch} channel={channel} setChannel={setChannel} category={category} setCategory={setCategory} />
          <Separator className="my-6" />

          <Tabs defaultValue="all" value={category} onValueChange={(v) => setCategory(v as Category | "all")} className="mb-6">
            <TabsList className="flex flex-wrap gap-2 bg-transparent p-0">
              {(["all","base","writing","model","script","bundle","modelAsset","article"] as const).map(c => (
                <TabsTrigger
                  key={c}
                  value={c}
                  className="border border-nothing-line-2 data-[state=active]:border-nothing-display"
                >
                  {c === "all" ? "全部" : LABELS.category[c]}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={category} />
          </Tabs>

          {filtered.length === 0 ? (
            <EmptyState onClear={() => { setQ(""); setOs("all"); setArch("all"); setCategory("all"); }} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(p => (
                <ProjectCard
                  key={p.slug}
                  project={p}
                  channel={channel}
                  os={os}
                  arch={arch}
                  onOpen={() => setActiveProject(p)}
                  onCopy={(text) => {
                    navigator.clipboard.writeText(text);
                    toast?.({ title: "已复制", description: text, duration: 1500 });
                  }}
                />
              ))}
            </div>
          )}

          <Dialog open={!!activeProject} onOpenChange={(open)=> !open && setActiveProject(null)}>
            <DialogContent className="max-w-3xl bg-nothing-glass backdrop-blur-[12px] border-none" overlayClassName="bg-black/60">
              {activeProject && <ProjectModal project={activeProject} channel={channel} />}
            </DialogContent>
          </Dialog>
        </div>
        <Footer border />
      </div>
    </TooltipProvider>
  );
}

function HeaderBar() {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-nothing-line bg-nothing-glass backdrop-blur-[16px]">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Package2 className="size-5 text-nothing-primary"/>
          <span className="font-nothing-head font-semibold tracking-tight text-nothing-display">ToolHub</span>
          <Badge variant="outline" className="ml-2 hidden sm:inline">OSS</Badge>
        </div>
        <div className="hidden items-center gap-4 text-sm text-nothing-secondary md:flex">
          <Link className="transition-opacity duration-200 ease-in-out hover:opacity-80" href="/">首页</Link>
          <Link className="transition-opacity duration-200 ease-in-out hover:opacity-80" href="/docs">文档</Link>
          <a className="transition-opacity duration-200 ease-in-out hover:opacity-80" href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="hidden sm:inline-flex"><Github className="mr-1 size-4"/>Star</Button>
          <Button size="sm" className="h-8">提交工具</Button>
        </div>
      </div>
    </header>
  );
}

function HeroBar() {
  return (
    <section className="relative py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-4 grid md:grid-cols-2 items-center gap-8">
        <div>
          <h1 className="font-nothing-head text-3xl font-semibold tracking-tight text-nothing-display md:text-[2rem]">
            软件分发橱窗
          </h1>
          <p className="mt-3 text-nothing-secondary font-nothing-ui">
            集中展示 • 多平台下载 • 版本与渠道一体化。支持 Brew/Winget/Scoop 命令复制与直链下载统计。
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-nothing-secondary">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4"/> SHA256 校验</span>
            <span className="inline-flex items-center gap-1.5"><Cpu className="size-4"/> amd64 / arm64</span>
            <span className="inline-flex items-center gap-1.5"><Layers3 className="size-4"/> stable / beta / dev</span>
          </div>
        </div>
        <div className="rounded-[var(--nothing-r-md)] bg-nothing-glass p-4 backdrop-blur-[12px]">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <SpecItem icon={<Apple className="size-4"/>} title="macOS" desc="Brew / DMG / Tar"/>
            <SpecItem icon={<Monitor className="size-4"/>} title="Windows" desc="winget / exe"/>
            <SpecItem icon={<Terminal className="size-4"/>} title="Linux" desc="deb / rpm / tar"/>
          </div>
        </div>
      </div>
    </section>
  );
}

function SpecItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="rounded-[var(--nothing-r-sm)] bg-nothing-surface/60 p-3">
      <div className="flex items-center gap-2 font-nothing-head font-medium text-nothing-primary">{icon} {title}</div>
      <div className="mt-1 text-xs text-nothing-secondary font-nothing-ui">{desc}</div>
    </div>
  );
}

function FilterBar(props: {
  q: string; setQ: (v: string)=>void;
  os: OS | "all"; setOs: (v: OS | "all")=>void;
  arch: Arch | "all"; setArch: (v: Arch | "all")=>void;
  channel: Channel; setChannel: (v: Channel)=>void;
  category: Category | "all"; setCategory: (v: Category | "all")=>void;
}) {
  const { q, os, arch, channel } = props;
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-nothing-muted"/>
          <Input
            placeholder="搜索工具名称或描述…"
            value={q}
            onChange={(e)=>props.setQ(e.target.value)}
            className="border-nothing-line-2 bg-nothing-glass pl-9 font-nothing-ui text-nothing-primary backdrop-blur-[12px] placeholder:text-nothing-muted"
          />
        </div>
        <Button variant="outline" size="icon" className="shrink-0"><Settings2 className="size-4"/></Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={os} onValueChange={(v) => props.setOs(v as OS | "all")} className="w-[140px]">
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="操作系统"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部 OS</SelectItem>
            <SelectItem value="darwin">macOS</SelectItem>
            <SelectItem value="windows">Windows</SelectItem>
            <SelectItem value="linux">Linux</SelectItem>
          </SelectContent>
        </Select>
        <Select value={arch} onValueChange={(v) => props.setArch(v as Arch | "all")} className="w-[140px]">
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="架构"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部架构</SelectItem>
            <SelectItem value="amd64">amd64</SelectItem>
            <SelectItem value="arm64">arm64</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={(v) => props.setChannel(v as Channel)} className="w-[140px]">
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="通道"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="stable">stable</SelectItem>
            <SelectItem value="beta">beta</SelectItem>
            <SelectItem value="dev">dev</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ProjectCard({ project, channel, os, arch, onOpen, onCopy }: {
  project: Project; channel: Channel; os: OS | "all"; arch: Arch | "all";
  onOpen: ()=>void; onCopy: (text: string)=>void;
}) {
  const rel = useMemo(() => pickRelease(project, channel), [project, channel]);
  const assets = useMemo(() => filterAssets(rel.assets, os, arch), [rel, os, arch]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="truncate">{project.name}</span>
          <span className="font-nothing-mono text-[10px] uppercase tracking-[0.08em] text-nothing-secondary">{LABELS.category[project.category]}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="line-clamp-2 text-sm text-nothing-secondary font-nothing-ui">{project.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-nothing-mono text-[11px] uppercase tracking-[0.08em] text-nothing-secondary">v{rel.version}</span>
          <Badge variant="outline">{channel}</Badge>
          <span className="font-nothing-mono text-[10px] uppercase tracking-[0.08em] text-nothing-muted">{project.license}</span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2"><Download className="size-4"/>下载</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[260px] border-nothing-line-2 bg-nothing-surface text-nothing-primary shadow-none">
              {assets.length === 0 && <div className="px-3 py-2 text-sm text-nothing-secondary">当前筛选无匹配资产</div>}
              {assets.map(a => (
                <DropdownMenuItem key={a.id} asChild className="focus:!bg-nothing-raised focus:!text-nothing-primary">
                  <a href={assetLink(a)} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-nothing-ui">{displayAsset(a)}</span>
                    <span className="font-nothing-mono text-xs text-nothing-secondary">{fmtSize(a.sizeBytes)}</span>
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" disabled={assets.length===0} onClick={() => assets.length>0 && onCopy(assetLink(assets[0]))}><Copy className="size-4"/></Button>
            </TooltipTrigger>
            <TooltipContent className="bg-nothing-surface text-nothing-primary border-nothing-line-2">复制下载链接</TooltipContent>
          </Tooltip>
          <Button size="sm" variant="ghost" onClick={onOpen} className="ml-auto gap-1">
            版本与日志 <ExternalLink className="size-4"/>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectModal({ project, channel }: { project: Project; channel: Channel }) {
  const rels = project.releases.filter(r => r.channel === channel).sort((a,b)=> (new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()));
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {project.name}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-6">
        {rels.map(r => (
          <div key={r.version} className="border-t border-nothing-line pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-nothing-mono text-[11px] uppercase tracking-[0.08em] text-nothing-primary">v{r.version}</span>
              <span className="font-nothing-mono text-xs text-nothing-muted">{new Date(r.publishedAt).toLocaleDateString()}</span>
              <Badge variant="outline">{r.channel}</Badge>
              {r.notesUrl && (
                <a className="text-xs text-nothing-secondary transition-opacity duration-200 ease-in-out hover:opacity-80" href={r.notesUrl} target="_blank" rel="noreferrer">变更日志</a>
              )}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {r.assets.map(a => (
                <a
                  key={a.id}
                  href={assetLink(a)}
                  className="flex items-center justify-between rounded-[var(--nothing-r-sm)] border border-nothing-line px-3 py-2 text-sm transition-colors duration-200 ease-in-out hover:bg-nothing-raised"
                >
                  <span className="font-nothing-ui text-nothing-primary">{displayAsset(a)}</span>
                  <span className="font-nothing-mono text-xs text-nothing-secondary">{fmtSize(a.sizeBytes)}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="empty-state">
      <div className="font-nothing-display text-4xl text-nothing-secondary">::</div>
      <div className="text-center">
        <h3 className="font-nothing-head text-lg font-semibold text-nothing-display">未找到匹配的工具</h3>
        <p className="mt-1 text-sm text-nothing-secondary">尝试调整筛选条件或搜索关键词</p>
      </div>
      <Button onClick={onClear}>清除筛选</Button>
    </div>
  );
}

// ----------------------------- 工具/类型 ------------------------------

type OS = "darwin" | "windows" | "linux";
type Arch = "amd64" | "arm64";
type Channel = "stable" | "beta" | "dev";
type Category = "base" | "writing" | "model" | "script" | "bundle" | "modelAsset" | "article";

interface Asset { id: string; filename: string; sizeBytes: number; sha256: string; os?: OS | "any"; arch?: Arch | "any"; url?: string; }
interface Release { version: string; channel: Channel; publishedAt: string; notesUrl?: string; assets: Asset[]; }
interface Project {
  slug: string; name: string; description?: string; category: Category; license?: string; repo?: string; releases: Release[];
}

const LABELS = {
  category: {
    base: "基础工具",
    writing: "写作工具",
    model: "模型工具",
    script: "脚本工具",
    bundle: "整合包",
    modelAsset: "模型",
    article: "文章",
    all: "全部",
  } as const,
};

function detectOS(): OS | "all" {
  if (typeof navigator === "undefined") return "all";
  const s = navigator.userAgent.toLowerCase();
  if (s.includes("mac")) return "darwin";
  if (s.includes("win")) return "windows";
  if (s.includes("linux")) return "linux";
  return "all";
}

function pickRelease(project: Project, channel: Channel): Release {
  const rel = project.releases.filter(r => r.channel === channel).sort((a,b)=> (new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()))[0];
  return rel ?? project.releases[0];
}

function filterAssets(assets: Asset[], os: OS | "all", arch: Arch | "all") {
  return assets.filter(a => {
    const matchOs = os === "all" || !a.os || a.os === "any" || a.os === os;
    const matchArch = arch === "all" || !a.arch || a.arch === "any" || a.arch === arch;
    return matchOs && matchArch;
  });
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ["KB","MB","GB","TB"]; let i = -1; let v = n;
  do { v /= 1024; i++; } while (v >= 1024 && i < u.length-1);
  return `${v.toFixed(1)} ${u[i]}`;
}

function assetLink(a: Asset) {
  if (!a) return ''
  const u = a.url || ''
  try {
    if (u && /^https?:\/\//.test(u)) {
      const url = new URL(u)
      // If points to our storage path, always use relative direct link to avoid mixed-content and enforce https
      if (url.pathname.startsWith(`/api/v1/storage/files/${a.id}/`)) {
        return `/api/v1/storage/files/${a.id}/download-direct?ttl=600`
      }
      // Upgrade to https when same host
      if (typeof location !== 'undefined' && url.host === location.host && url.protocol === 'http:') {
        return `https://${url.host}${url.pathname}${url.search}${url.hash}`
      }
      return u
    }
  } catch {
    // On URL parsing or other errors, fall back to a safe internal direct download link
  }
  return `/api/v1/storage/files/${a.id}/download-direct?ttl=600`
}


function displayAsset(a: Asset) {
  const osLabel = a.os && a.os !== "any" ? ({ darwin: "macOS", windows: "Windows", linux: "Linux" } as const)[a.os as OS] : undefined;
  const arch = a.arch && a.arch !== "any" ? a.arch : undefined;
  if (osLabel || arch) {
    return `${osLabel ?? "通用"}${arch ? ` • ${arch}` : ""} • ${a.filename}`;
  }
  return a.filename;
}

// ----------------------------- 示例数据（可删） -----------------------------

const SAMPLE_PROJECTS: Project[] = [
  {
    slug: "webgal",
    name: "WebGAL",
    description: "开源可视小说引擎，基础运行环境与工具集。",
    category: "base",
    license: "GPL-3.0",
    repo: "https://github.com/OpenWebGAL/WebGAL.git",
    releases: [
      {
        version: "1.0.0",
        channel: "stable",
        publishedAt: "2025-09-01T00:00:00Z",
        assets: [
          { id: "w1", os: "windows", arch: "amd64", filename: "webgal_1.0.0_windows_amd64.zip", sizeBytes: 50270208, sha256: "..." },
          { id: "w2", os: "darwin", arch: "arm64", filename: "webgal_1.0.0_darwin_arm64.zip", sizeBytes: 49807360, sha256: "..." },
          { id: "w3", os: "linux", arch: "amd64", filename: "webgal_1.0.0_linux_amd64.tar.gz", sizeBytes: 47185920, sha256: "..." },
        ]
      }
    ]
  },
  {
    slug: "writing-kit",
    name: "写作工具占位",
    description: "占位：后续从 OSS 读取清单并替换为真实条目。",
    category: "writing",
    license: "MIT",
    releases: [
      {
        version: "0.1.0",
        channel: "stable",
        publishedAt: "2025-09-01T00:00:00Z",
        assets: [
          { id: "x1", filename: "写作指南.txt", sizeBytes: 4096, sha256: "...", url: "https://example.com/oss/writing/guide.txt" },
          { id: "x2", filename: "writing-kit_0.1.0.zip", sizeBytes: 10485760, sha256: "...", url: "https://example.com/oss/writing/writing-kit_0.1.0.zip" },
        ]
      }
    ]
  },
  {
    slug: "live2dwatcher",
    name: "Live2DWatcher",
    description: "占位：模型工具（未开源），提供预编译包示例。",
    category: "model",
    license: "Proprietary",
    releases: [
      {
        version: "0.9.0",
        channel: "stable",
        publishedAt: "2025-08-20T00:00:00Z",
        assets: [
          { id: "m1", os: "windows", arch: "amd64", filename: "live2dwatcher_0.9.0_windows_amd64.zip", sizeBytes: 62914560, sha256: "..." },
        ]
      }
    ]
  },
  {
    slug: "anogo",
    name: "anogo",
    description: "脚本工具，占位示例（仓库参考 A-kirami/anogo）。",
    category: "script",
    license: "MIT",
    repo: "https://github.com/A-kirami/anogo.git",
    releases: [
      {
        version: "1.2.0",
        channel: "stable",
        publishedAt: "2025-09-10T00:00:00Z",
        assets: [
          { id: "s1", os: "linux", arch: "amd64", filename: "anogo_1.2.0_linux_amd64.tar.gz", sizeBytes: 15728640, sha256: "..." },
          { id: "s2", os: "windows", arch: "amd64", filename: "anogo_1.2.0_windows_amd64.zip", sizeBytes: 18874368, sha256: "..." },
        ]
      }
    ]
  },
  {
    slug: "mygo-3",
    name: "MyGo 3.0",
    description: "整合包占位，实际交付为 zip 包。",
    category: "bundle",
    license: "Proprietary",
    releases: [
      {
        version: "3.0.0",
        channel: "stable",
        publishedAt: "2025-09-15T00:00:00Z",
        assets: [
          { id: "b1", os: "windows", arch: "amd64", filename: "mygo-3.0.0_windows_amd64.zip", sizeBytes: 104857600, sha256: "..." },
          { id: "b2", os: "darwin", arch: "arm64", filename: "mygo-3.0.0_darwin_arm64.zip", sizeBytes: 94371840, sha256: "..." },
          { id: "b3", os: "linux", arch: "amd64", filename: "mygo-3.0.0_linux_amd64.tar.gz", sizeBytes: 94371840, sha256: "..." },
        ]
      }
    ]
  }
,
  {
    slug: "sdxl-1-0",
    name: "SDXL 1.0",
    description: "AI 模型占位（模型分发示例）。",
    category: "modelAsset",
    license: "Proprietary",
    releases: [
      {
        version: "1.0.0",
        channel: "stable",
        publishedAt: "2025-09-10T00:00:00Z",
        assets: [
          { id: "ma1", filename: "sdxl-1.0.safetensors", sizeBytes: 123456789, sha256: "..." }
        ]
      }
    ]
  },
  {
    slug: "article-sample",
    name: "文章示例",
    description: "文章分发占位，使用直链作为资源。",
    category: "article",
    license: "CC-BY-4.0",
    releases: [
      {
        version: "2025.09",
        channel: "stable",
        publishedAt: "2025-09-18T00:00:00Z",
        assets: [
          { id: "ar1", filename: "如何使用工具.md", sizeBytes: 20480, sha256: "...", url: "https://example.com/docs/howto.md" }
        ]
      }
    ]
  }
];
