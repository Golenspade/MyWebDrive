import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

export function RecentSales() {
  const items = [
    { name: "olivia_martin", ip: "192.168.1.101", file: "视频.mp4", fallback: "OM", src: "/avatars/01.png" },
    { name: "jackson_lee", ip: "192.168.1.102", file: "文档.pdf", fallback: "JL", src: "/avatars/02.png" },
    { name: "isabella_nguyen", ip: "192.168.1.103", file: "音乐.mp3", fallback: "IN", src: "/avatars/03.png" },
    { name: "william_kim", ip: "192.168.1.104", file: "软件.zip", fallback: "WK", src: "/avatars/04.png" },
    { name: "sofia_davis", ip: "192.168.1.105", file: "图片.jpg", fallback: "SD", src: "/avatars/05.png" },
  ]

  return (
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.name} className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src={item.src} alt="Avatar" />
            <AvatarFallback className="bg-nothing-raised text-sm text-nothing-primary">
              {item.fallback}
            </AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none text-nothing-primary">
              用户 {item.name}
            </p>
            <p className="text-sm text-nothing-secondary">{item.ip}</p>
          </div>
          <div className="ml-auto text-sm font-medium text-nothing-primary">
            {item.file}
          </div>
        </div>
      ))}
    </div>
  )
}
