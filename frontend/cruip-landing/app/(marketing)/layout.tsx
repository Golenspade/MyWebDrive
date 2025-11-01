import "aos/dist/aos.css"

import Header from "@/components/ui/header"
import Footer from "@/components/ui/footer"
import ClientEffects from "@/components/ui/client-effects"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="cursor-none">
      {/* Client-only effects without forcing whole layout to be client */}
      <ClientEffects />

      <Header />
      <main className="grow">{children}</main>
      <Footer border={true} />
    </div>
  )
}
