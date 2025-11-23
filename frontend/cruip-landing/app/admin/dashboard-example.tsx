import { Metadata } from "next"

// Example standalone dashboard page used during development only.
export const metadata: Metadata = {
  title: "Dashboard",
  description: "Example dashboard app built using the components.",
}

export default function DashboardPage() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold">Dashboard Example</h2>
      <p className="text-muted-foreground">This example page is disabled in the production build.</p>
    </div>
  )
}
