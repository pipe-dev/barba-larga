import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin - Barba Larga",
  description: "Panel de administración para la barbería Barba Larga.",
  manifest: "/manifest.json",
  themeColor: "#20120b",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Barba Larga Admin",
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
