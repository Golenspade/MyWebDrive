import Header from "@/components/ui/header";
import Footer from "@/components/ui/footer";
import HeroHome from "@/components/hero-home";

export default function Page() {
  return (
    <>
      <Header />
      <main className="grow">
        <HeroHome />
      </main>
      <Footer border />
    </>
  );
}
