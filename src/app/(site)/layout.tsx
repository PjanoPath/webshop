import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AutumnLeaves from '@/components/AutumnLeaves';
import { CartProvider } from '@/context/CartContext';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {/* Site-wide backdrop: background.jpg, softly blurred and tinted so it reads as texture
          behind the (mostly opaque, white-card) content rather than competing with it. Scoped
          to the customer-facing site only, not the admin panel. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-cream-50">
        <div
          className="absolute -inset-10 bg-cover bg-center opacity-25 blur-[6px]"
          style={{ backgroundImage: "url('/background.jpg')" }}
        />
        <div className="absolute inset-0 bg-cream-50/60" />
      </div>
      <AutumnLeaves />
      <Header />
      <main>{children}</main>
      <Footer />
    </CartProvider>
  );
}
