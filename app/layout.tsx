import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JANI//OS — Workbench",
  description: "An interactive portfolio operating system for the browser.",
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
