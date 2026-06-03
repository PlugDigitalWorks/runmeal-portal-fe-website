import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { UserProvider } from "@/context/UserContext";
import { BranchProvider } from "@/context/BranchContext";
import { CartProvider } from "@/context/CartContext";
import { Toaster } from "sonner";
import { GoogleMapsProvider } from "@/providers/GoogleMapsProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://portalfe.runmeal.com"),
  title: {
    default: "Runmeal",
    template: "%s | Runmeal",
  },
  description:
    "Order food from nearby restaurants with Runmeal.",
  applicationName: "Runmeal",
  keywords: [
    "Runmeal",
    "food delivery",
    "restaurant delivery",
    "online food order",
  ],
  authors: [{ name: "Runmeal" }],
  creator: "Runmeal",
  publisher: "Runmeal",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://portalfe.runmeal.com",
    siteName: "Runmeal",
    title: "Runmeal",
    description:
      "Order food from nearby restaurants with Runmeal.",
  },
  twitter: {
    card: "summary",
    title: "Runmeal",
    description:
      "Order food from nearby restaurants with Runmeal.",
  },
  icons: {
    icon: [
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
      },
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  category: "food",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UserProvider>
          <BranchProvider>
            <CartProvider>
              <GoogleMapsProvider>
                <GlobalHeader />
                {children}
              </GoogleMapsProvider>
              <Toaster position="top-left" richColors toastOptions={{ style: { marginTop: '60px' } }} />
            </CartProvider>
          </BranchProvider>
        </UserProvider>
      </body>
    </html>
  );
}
