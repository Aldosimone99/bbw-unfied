import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beauty Broker World | La bellezza di essere in salute",
  description: "Beauty Broker World, piattaforma digitale italiana per medicina estetica, longevita e benessere.",
  icons: {
    icon: "/images/brand/icon-flat.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
