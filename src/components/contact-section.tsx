
"use client";

import Link from "next/link";
import { Instagram, Phone } from "lucide-react";
import { TikTokIcon, WhatsAppIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export function ContactSection() {
  const socialLinks = [
    {
      href: "https://api.whatsapp.com/send?phone=573027128176&text=Hola%F0%9F%92%88",
      label: "WhatsApp",
      icon: WhatsAppIcon,
      className: "whatsapp",
    },
    {
      href: "https://www.instagram.com/barbalargapopayan/",
      label: "Instagram",
      icon: Instagram,
      className: "instagram",
    },
    {
      href: "https://www.tiktok.com/@barbalarga_",
      label: "TikTok",
      icon: TikTokIcon,
      className: "tiktok",
    },
    {
      href: "tel:+573027128176",
      label: "Llamar",
      icon: Phone,
      className: "phone",
    },
  ];

  return (
    <section id="contact" className="py-12 md:py-24 text-center">
      <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">
        Contáctanos
      </h2>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-2xl mx-auto">
        {socialLinks.map(({ href, label, icon: Icon, className }) => (
          <Link key={href} href={href} target="_blank" rel="noopener noreferrer">
            <button className={`liquid-glass-button ${className} w-full`}>
                <Icon className="h-6 w-6" />
                <span>{label}</span>
            </button>
          </Link>
        ))}
      </div>
    </section>
  );
}
