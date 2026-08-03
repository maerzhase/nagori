import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memory Screen",
  description: "A private family photo frame for the people you love.",
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
