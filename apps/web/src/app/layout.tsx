import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // The icon, apple-icon and opengraph-image files next to this layout are
  // picked up by Next's file conventions; metadataBase is what turns the
  // generated image paths into the absolute URLs link previews need.
  metadataBase: new URL("https://nagori.m3000.io"),
  title: "Nagori (名残)",
  description: "Private family memories that remain.",
  openGraph: {
    title: "Nagori (名残)",
    description: "Private family memories that remain.",
    type: "website",
  },
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
