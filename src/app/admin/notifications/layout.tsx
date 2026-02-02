import type { Metadata } from "next";
import "../admin.css";

export const metadata: Metadata = {
  title: "Notificaciones - Admin Barba Larga",
  description: "Gestión de notificaciones para la barbería Barba Larga.",
};

export default function NotificationsAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}

    