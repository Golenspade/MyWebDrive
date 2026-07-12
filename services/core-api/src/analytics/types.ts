export type DashboardRangeKind = 'today' | '7d' | '30d'

export type DashboardRange = {
  kind: DashboardRangeKind
  timezone: 'Asia/Shanghai'
  start: Date
  end: Date
  dates: string[]
}

export type CountBytesSeriesPoint = {
  date: string
  count: string | null
  bytes: string | null
}

export type CountSeriesPoint = { date: string; count: string | null }

export type BusinessDashboardResponse = {
  range: Omit<DashboardRange, 'start' | 'end' | 'dates'> & {
    start: string
    end: string
  }
  generatedAt: string
  coverage: {
    uploadsFrom: string | null
    downloadsFrom: string | null
    complete: boolean
  }
  totals: {
    totalUsers: string
    liveFiles: string
    committedStorageBytes: string
  }
  activity: {
    uploads: {
      count: string | null
      bytes: string | null
      series: CountBytesSeriesPoint[]
    }
    downloads: {
      count: string | null
      bytes: string | null
      series: CountBytesSeriesPoint[]
    }
    activeUsers: { count: string | null; series: CountSeriesPoint[] }
  }
  freshness: {
    readModelUpdatedAt: string | null
    lagSeconds: number | null
  }
}
