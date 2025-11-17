import MarketingLayout from './(marketing)/layout'
import MarketingPage, { metadata } from './(marketing)/page'

export { metadata }

export default function RootMarketingPage() {
  return (
    <MarketingLayout>
      <MarketingPage />
    </MarketingLayout>
  )
}
