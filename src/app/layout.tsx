import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapBid — Photo to paid quote in 60 seconds",
  description:
    "Snap photos of the job, AI drafts an itemized quote from your price book, client accepts and pays a deposit online. Built for lawn care, pressure washing, fencing, and painting crews.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
