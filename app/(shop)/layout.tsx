import { CartProvider } from 'components/cart/cart-context';
import { Navbar } from 'components/layout/navbar';
import { WelcomeToast } from 'components/welcome-toast';
import { getCart } from 'lib/shopify';
import { ReactNode } from 'react';
import { baseUrl } from 'lib/utils';

const { SITE_NAME } = process.env;

export const metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: SITE_NAME!,
    template: `%s | ${SITE_NAME}`
  },
  robots: {
    follow: true,
    index: true
  }
};

export default async function ShopLayout({ children }: { children: ReactNode }) {
  const cart = getCart();
  return (
    <CartProvider cartPromise={cart}>
      <Navbar />
      <main>
        {children}
        <WelcomeToast />
      </main>
    </CartProvider>
  );
}
