import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import GlobalRefreshWrapper from "@/components/GlobalRefreshWrapper";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FF7E36", // Primary orange
};

export const metadata: Metadata = {
  title: "Learn Loop",
  description: "Gamified productivity app for students",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <title>Learn Loop</title>
      </head>
      <body className={inter.className}>
        <AppProvider>
          <GlobalRefreshWrapper>
            {children}
          </GlobalRefreshWrapper>
        </AppProvider>
      </body>
    </html>
  );
}
