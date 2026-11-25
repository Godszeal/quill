import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Quill — long-form research writing agent",
  description:
    "Write 20–150 page theses, projects, and literature reviews with live journal harvest, consistent structure, and PDF/DOCX export.",
  openGraph: {
    title: "Quill — long-form research writing agent",
    description:
      "Write 20–150 page theses, projects, and literature reviews with live journal harvest, consistent structure, and PDF/DOCX export.",
    type: "website",
    url: "https://quill-jade-delta.vercel.app",
    siteName: "Quill",
    images: [
      {
        url: "/og-image.webp",
        width: 1200,
        height: 630,
        alt: "Quill — long-form research writing agent",
        type: "image/webp",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quill — long-form research writing agent",
    description:
      "Write 20–150 page theses, projects, and literature reviews with live journal harvest, consistent structure, and PDF/DOCX export.",
    images: ["/og-image.webp"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07111f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link rel="icon" type="image/webp" href="/favicon.webp" />
        <link rel="apple-touch-icon" type="image/webp" href="/favicon.webp" />
        <link rel="shortcut icon" type="image/webp" href="/favicon.webp" />
      </head>
      <body className={`${outfit.variable} ${fraunces.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
