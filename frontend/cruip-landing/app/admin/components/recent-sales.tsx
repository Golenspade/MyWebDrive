import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

export function RecentSales() {
  return (
    <div className="space-y-8">
      <div className="flex items-center">
        <Avatar className="h-9 w-9">
          <AvatarImage src="/avatars/01.png" alt="Avatar" />
          <AvatarFallback>OM</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">用户 olivia_martin</p>
          <p className="text-sm text-muted-foreground">
            192.168.1.101
          </p>
        </div>
        <div className="ml-auto font-medium text-sm">视频.mp4</div>
      </div>
      <div className="flex items-center">
        <Avatar className="flex h-9 w-9 items-center justify-center space-y-0 border">
          <AvatarImage src="/avatars/02.png" alt="Avatar" />
          <AvatarFallback>JL</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">用户 jackson_lee</p>
          <p className="text-sm text-muted-foreground">192.168.1.102</p>
        </div>
        <div className="ml-auto font-medium text-sm">文档.pdf</div>
      </div>
      <div className="flex items-center">
        <Avatar className="h-9 w-9">
          <AvatarImage src="/avatars/03.png" alt="Avatar" />
          <AvatarFallback>IN</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">用户 isabella_nguyen</p>
          <p className="text-sm text-muted-foreground">
            192.168.1.103
          </p>
        </div>
        <div className="ml-auto font-medium text-sm">音乐.mp3</div>
      </div>
      <div className="flex items-center">
        <Avatar className="h-9 w-9">
          <AvatarImage src="/avatars/04.png" alt="Avatar" />
          <AvatarFallback>WK</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">用户 william_kim</p>
          <p className="text-sm text-muted-foreground">192.168.1.104</p>
        </div>
        <div className="ml-auto font-medium text-sm">软件.zip</div>
      </div>
      <div className="flex items-center">
        <Avatar className="h-9 w-9">
          <AvatarImage src="/avatars/05.png" alt="Avatar" />
          <AvatarFallback>SD</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">用户 sofia_davis</p>
          <p className="text-sm text-muted-foreground">192.168.1.105</p>
        </div>
        <div className="ml-auto font-medium text-sm">图片.jpg</div>
      </div>
    </div>
  )
}
