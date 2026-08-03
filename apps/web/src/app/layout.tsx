import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nagori (名残)",
  description: "Private family memories that remain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
