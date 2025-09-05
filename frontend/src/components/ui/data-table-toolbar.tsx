import { Cross2Icon } from "@radix-ui/react-icons"
import { Table } from "@tanstack/react-table"
import { Search } from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  searchKey?: string
}

export function DataTableToolbar<TData>({
  table,
  searchKey = "name",
}: DataTableToolbarProps<TData>) {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get("search") || ""

  const isFiltered = table.getState().columnFilters.length > 0 || search !== ""

  const handleSearch = (value: string) => {
    const newSearchParams = new URLSearchParams(searchParams)
    if (value) {
      newSearchParams.set("search", value)
      newSearchParams.set("page", "1") // 重置到第一页
    } else {
      newSearchParams.delete("search")
    }
    setSearchParams(newSearchParams, { replace: true })
  }

  const handleReset = () => {
    table.resetColumnFilters()
    const newSearchParams = new URLSearchParams()
    // 保留一些基本参数
    if (searchParams.get("per_page")) {
      newSearchParams.set("per_page", searchParams.get("per_page")!)
    }
    setSearchParams(newSearchParams, { replace: true })
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`搜索${searchKey}...`}
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            className="pl-8"
          />
        </div>
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={handleReset}
            className="h-8 px-2 lg:px-3"
          >
            重置
            <Cross2Icon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}
