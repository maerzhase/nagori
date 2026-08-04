import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nagori (名残)",
  description: "Private family memories that remain.",
  // iOS turns anything that looks like a phone number or date into a link and
  // paints it system blue, which is unreadable on our cream surfaces.
  formatDetection: { telephone: false, date: false, address: false },
};

export const viewport: Viewport = {
  colorScheme: "light",
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
