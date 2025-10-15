"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"

const data = [
  {
    name: "周一",
    total: Math.floor(Math.random() * 3000) + 500,
  },
  {
    name: "周二",
    total: Math.floor(Math.random() * 3000) + 500,
  },
  {
    name: "周三",
    total: Math.floor(Math.random() * 3000) + 500,
  },
  {
    name: "周四",
    total: Math.floor(Math.random() * 3000) + 500,
  },
  {
    name: "周五",
    total: Math.floor(Math.random() * 3000) + 500,
  },
  {
    name: "周六",
    total: Math.floor(Math.random() * 3000) + 500,
  },
  {
    name: "周日",
    total: Math.floor(Math.random() * 3000) + 500,
  },
]

export function Overview() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Bar
          dataKey="total"
          fill="currentColor"
          radius={[4, 4, 0, 0]}
          className="fill-primary"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
