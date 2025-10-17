"use client";

import React, { useMemo, useState } from "react";
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
import { Copy, Download, Github, Layers3, Search, Settings2, Sparkles, Terminal, ExternalLink, Apple, Monitor, Cpu, ShieldCheck, Package2 } from "lucide-react";

export default function AppCatalogPage() {
  const [q, setQ] = useState("");
  const [os, setOs] = useState<OS | "all">(detectOS());
  const [arch, setArch] = useState<Arch | "all">("all");
  const [channel, setChannel] = useState<Channel>("stable");
  const [category, setCategory] = useState<Category | "all">("all");
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const { toast } = useToast?.() ?? { toast: () => {} } as any;

  const data = useMemo(() => SAMPLE_PROJECTS, []);

  const filtered = useMemo(() => {
    return data.filter(p => {
      const matchQ = q ? (p.name.toLowerCase().includes(q.toLowerCase()) || p.description.toLowerCase().includes(q.toLowerCase())) : true;
      const matchCat = category === "all" ? true : p.category === category;
      const matchAsset = p.releases.some(r => r.channel === channel && r.assets.some(a => (os === "all" || a.os === os) && (arch === "all" || a.arch === arch)));
      return matchQ && matchCat && matchAsset;
    });
  }, [data, q, os, arch, channel, category]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <HeaderBar />
        <HeroBar />
        <div className="mx-auto max-w-7xl px-4 pb-24">
          <FilterBar q={q} setQ={setQ} os={os} setOs={setOs} arch={arch} setArch={setArch} channel={channel} setChannel={setChannel} category={category} setCategory={setCategory} />
          <Separator className="my-6" />
          <Tabs defaultValue="all" value={category} onValueChange={(v)=>setCategory(v as any)} className="mb-6">
            <TabsList className="flex flex-wrap gap-2">
              {(["all","cli","desktop","web","plugin"] as const).map(c => (
                <TabsTrigger key={c} value={c} className="capitalize">{c === "all" ? "全部" : LABELS.category[c]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

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

          <Dialog open={!!activeProject} onOpenChange={(open)=> !open && setActiveProject(null)}>
            <DialogContent className="max-w-3xl">
              {activeProject && <ProjectModal project={activeProject} channel={channel} />}
            </DialogContent>
          </Dialog>
        </div>
        <FooterBar />
      </div>
    </TooltipProvider>
  );
}

function HeaderBar() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur border-b border-border/60 supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package2 className="size-5 text-primary"/>
          <span className="font-semibold tracking-tight">ToolHub</span>
          <Badge variant="outline" className="ml-2 hidden sm:inline">OSS</Badge>
        </div>
        <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
          <a className="hover:text-foreground" href="#">首页</a>
          <a className="hover:text-foreground" href="#">文档</a>
          <a className="hover:text-foreground" href="#">GitHub</a>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="hidden sm:inline-flex"><Github className="mr-1 size-4"/>Star</Button>
          <Button size="sm" className="shadow-[0_0_0_1px_hsl(var(--primary))_inset]">提交工具</Button>
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
          <h1 className="text-3xl md:text-5xl font-semibold leading-[1.1] tracking-tight">
            软件分发 <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">橱窗</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            集中展示 • 多平台下载 • 版本与渠道一体化。支持 Brew/Winget/Scoop 命令复制与直链下载统计。
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="size-4"/> SHA256 校验</span>
            <span className="inline-flex items-center gap-1"><Cpu className="size-4"/> amd64 / arm64</span>
            <span className="inline-flex items-center gap-1"><Layers3 className="size-4"/> stable / beta / dev</span>
          </div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-transparent to-transparent p-6">
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

function FooterBar() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ToolHub
      </div>
    </footer>
  );
}


function SpecItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="rounded-xl border bg-background/70 p-3">
      <div className="flex items-center gap-2 font-medium">{icon} {title}</div>
      <div className="mt-1 text-muted-foreground">{desc}</div>
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
  const { q, setQ, os, setOs, arch, setArch, channel, setChannel } = props;
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex-1 flex items-center gap-2">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"/>
          <Input placeholder="搜索工具名称或描述…" className="pl-9" value={q} onChange={(e)=>props.setQ(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" className="shrink-0"><Settings2 className="size-4"/></Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={os} onValueChange={(v)=>props.setOs(v as any)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="操作系统"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部 OS</SelectItem>
            <SelectItem value="darwin">macOS</SelectItem>
            <SelectItem value="windows">Windows</SelectItem>
            <SelectItem value="linux">Linux</SelectItem>
          </SelectContent>
        </Select>
        <Select value={arch} onValueChange={(v)=>props.setArch(v as any)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="架构"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部架构</SelectItem>
            <SelectItem value="amd64">amd64</SelectItem>
            <SelectItem value="arm64">arm64</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={(v)=>props.setChannel(v as any)}>
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
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="truncate">{project.name}</span>
          <span className="text-xs text-muted-foreground">{LABELS.category[project.category]}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">v{rel.version}</Badge>
          <Badge variant="outline">{channel}</Badge>
          <Badge variant="outline">{project.license}</Badge>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2"><Download className="size-4"/>下载</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[260px]">
              {assets.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">当前筛选无匹配资产</div>}
              {assets.map(a => (
                <DropdownMenuItem key={a.id} asChild>
                  <a href={`/api/v1/storage/files/${a.id}/download-direct?ttl=600`} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">{displayAsset(a)}</span>
                    <span className="text-xs text-muted-foreground">{fmtSize(a.sizeBytes)}</span>
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger>
              <Button size="icon" variant="outline" onClick={() => onCopy(genInstallCmd(project, os))}><Copy className="size-4"/></Button>
            </TooltipTrigger>
            <TooltipContent>复制安装命令</TooltipContent>
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
          <Sparkles className="size-5 text-primary"/> {project.name}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-6">
        {rels.map(r => (
          <div key={r.version} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">v{r.version}</Badge>
              <span className="text-xs text-muted-foreground">{new Date(r.publishedAt).toLocaleDateString()}</span>
              <Badge variant="outline">{r.channel}</Badge>
              {r.notesUrl && (
                <a className="text-xs text-primary hover:underline" href={r.notesUrl} target="_blank" rel="noreferrer">变更日志</a>
              )}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {r.assets.map(a => (
                <a key={a.id} href={`/api/v1/storage/files/${a.id}/download-direct?ttl=600`} className="text-sm rounded-md border px-3 py-2 hover:bg-muted/50 flex items-center justify-between">
                  <span>{displayAsset(a)}</span>
                  <span className="text-xs text-muted-foreground">{fmtSize(a.sizeBytes)}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// Types and helpers

type OS = "darwin" | "windows" | "linux";
type Arch = "amd64" | "arm64";
type Channel = "stable" | "beta" | "dev";
type Category = "cli" | "desktop" | "web" | "plugin";

interface Asset { id: string; os: OS; arch: Arch; filename: string; sizeBytes: number; sha256: string; }
interface Release { version: string; channel: Channel; publishedAt: string; notesUrl?: string; assets: Asset[]; }
interface Project { slug: string; name: string; description: string; category: Category; license: string; repo?: string; releases: Release[]; }

const LABELS = {
  category: {
    cli: "命令行工具",
    desktop: "桌面应用",
    web: "Web/服务",
    plugin: "插件/扩展",
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
  return assets.filter(a => (os === "all" || a.os === os) && (arch === "all" || a.arch === arch));
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ["KB","MB","GB","TB"]; let i = -1; let v = n;
  do { v /= 1024; i++; } while (v >= 1024 && i < u.length-1);
  return `${v.toFixed(1)} ${u[i]}`;
}

function displayAsset(a: Asset) {
  const osLabel = { darwin: "macOS", windows: "Windows", linux: "Linux" }[a.os];
  return `${osLabel} • ${a.arch} • ${a.filename}`;
}

function genInstallCmd(project: Project, os: OS | "all") {
  const name = project.slug;
  if (os === "darwin") return `brew install ${name}`;
  if (os === "windows") return `winget install ${name}`;
  if (os === "linux") return `sudo apt install ${name}`;
  return `brew install ${name}`;
}

// Sample data

const SAMPLE_PROJECTS: Project[] = [
  {
    slug: "cli-sync",
    name: "CLI Sync",
    description: "跨平台命令行同步工具，支持增量/断点续传与加密。",
    category: "cli",
    license: "MIT",
    repo: "https://github.com/example/cli-sync",
    releases: [
      {
        version: "1.8.3",
        channel: "stable",
        publishedAt: "2025-09-20T10:20:00Z",
        notesUrl: "https://example.com/cli-sync/1.8.3",
        assets: [
          { id: "a1", os: "darwin", arch: "arm64", filename: "cli-sync_1.8.3_darwin_arm64.tar.gz", sizeBytes: 13842944, sha256: "..." },
          { id: "a2", os: "darwin", arch: "amd64", filename: "cli-sync_1.8.3_darwin_amd64.tar.gz", sizeBytes: 14102144, sha256: "..." },
          { id: "a3", os: "windows", arch: "amd64", filename: "cli-sync_1.8.3_windows_amd64.zip", sizeBytes: 15635456, sha256: "..." },
          { id: "a4", os: "linux", arch: "amd64", filename: "cli-sync_1.8.3_linux_amd64.tar.gz", sizeBytes: 12304128, sha256: "..." },
        ]
      },
      {
        version: "1.9.0-beta.2",
        channel: "beta",
        publishedAt: "2025-09-23T06:00:00Z",
        assets: [
          { id: "b1", os: "darwin", arch: "arm64", filename: "cli-sync_1.9.0-beta.2_darwin_arm64.tar.gz", sizeBytes: 13942944, sha256: "..." },
          { id: "b2", os: "linux", arch: "amd64", filename: "cli-sync_1.9.0-beta.2_linux_amd64.tar.gz", sizeBytes: 12404128, sha256: "..." },
        ]
      }
    ]
  },
  {
    slug: "desk-note",
    name: "DeskNote",
    description: "极简桌面便签，支持全局快捷键与云同步。",
    category: "desktop",
    license: "Apache-2.0",
    releases: [
      {
        version: "0.9.5",
        channel: "stable",
        publishedAt: "2025-08-11T12:00:00Z",
        assets: [
          { id: "c1", os: "windows", arch: "amd64", filename: "desknote_0.9.5_x64.exe", sizeBytes: 48532480, sha256: "..." },
          { id: "c2", os: "darwin", arch: "arm64", filename: "desknote_0.9.5_universal.dmg", sizeBytes: 62914560, sha256: "..." },
        ]
      },
      {
        version: "0.10.0-dev.1",
        channel: "dev",
        publishedAt: "2025-09-22T08:00:00Z",
        assets: [
          { id: "d1", os: "windows", arch: "amd64", filename: "desknote_0.10.0-dev.1_x64.exe", sizeBytes: 49112064, sha256: "..." },
        ]
      }
    ]
  },
  {
    slug: "img-optimizer",
    name: "Image Optimizer",
    description: "批量图片无损压缩与格式转换，命令与 GUI 混合模式。",
    category: "plugin",
    license: "GPL-3.0",
    releases: [
      {
        version: "2.2.1",
        channel: "stable",
        publishedAt: "2025-07-02T02:30:00Z",
        assets: [
          { id: "e1", os: "linux", arch: "amd64", filename: "img-opt_2.2.1_linux_amd64.tar.gz", sizeBytes: 21532672, sha256: "..." },
          { id: "e2", os: "darwin", arch: "arm64", filename: "img-opt_2.2.1_darwin_arm64.tar.gz", sizeBytes: 22021120, sha256: "..." },
        ]
      }
    ]
  }
];

