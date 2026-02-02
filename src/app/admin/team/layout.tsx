import type { Metadata } from "next";
import "../admin.css";

export const metadata: Metadata = {
  title: "Equipo - Admin Barba Larga",
  description: "Gestión de equipo para la barbería Barba Larga.",
};

export default function TeamAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
