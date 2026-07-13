import { Montserrat } from 'next/font/google';
import '../styles/dashboard.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});

export default function App({ Component, pageProps }) {
  return (
    <main className={montserrat.variable}>
      <Component {...pageProps} />
    </main>
  );
}
