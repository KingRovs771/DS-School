/**
 * pages/_app.tsx — Root app Next.js: Provider QueryClient + Toaster
 */
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import Head from "next/head";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "@/styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </Head>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <Component {...pageProps} />
        </ErrorBoundary>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#1e293b",
              color: "#f1f5f9",
              border: "1px solid #334155",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#10b981", secondary: "#f1f5f9" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#f1f5f9" },
            },
          }}
        />
      </QueryClientProvider>
    </>
  );
}
