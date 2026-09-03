import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { BookingProvider } from "@/hooks/booking-provider";
import { AudioStoreProvider } from "@/hooks/audio-store-provider";
import { WelcomeModal } from "@/components/welcome-modal";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barba Larga AppointMe",
  description: "Reserva tu cita en la barbería Barba Larga.",
  manifest: "/manifest.json",
  icons: {
    icon: "/multimedia/logo-barber.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="theme-color" content="#20120b" />
      </head>
      <body suppressHydrationWarning>
        <AudioStoreProvider>
          <BookingProvider>
            {children}
            <WelcomeModal />
            <Toaster />
          </BookingProvider>
        </AudioStoreProvider>
      </body>
    </html>
  );
}
