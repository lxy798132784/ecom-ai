import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { ThemeToggle } from '../components/ThemeToggle';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <Component {...pageProps} />
      <ThemeToggle />
    </SessionProvider>
  );
}
