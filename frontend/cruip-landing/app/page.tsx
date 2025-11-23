import MarketingLayout from './(marketing)/layout'
import MarketingPage, { metadata } from './(marketing)/page'

// Re-export the marketing page metadata so the root route matches `/`.
export { metadata }

export default function RootMarketingPage() {
  return (
    <MarketingLayout>
      <MarketingPage />
    </MarketingLayout>
  )
}
