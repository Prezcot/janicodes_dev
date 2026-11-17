import type { Metadata } from "next";
import "./globals.css";
import { cssVariables } from "../theme/theme";

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
    <html lang="en" style={cssVariables as React.CSSProperties}>
      <body>{children}</body>
    </html>
  );
}
