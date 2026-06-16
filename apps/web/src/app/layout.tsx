import type { Metadata } from "next";
import { DM_Mono, DM_Sans, Inter, Kalnia, Source_Serif_4 } from "next/font/google";
import { Toaster } from "~/components/ui/sonner";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const kalnia = Kalnia({
  subsets: ["latin"],
  variable: "--font-kalnia",
});

export const metadata: Metadata = {
  title: "Forum — Princeton Campus Events",
  description: "Your social life, curated. Discover campus events personalized for you.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${sourceSerif.variable} ${dmSans.variable} ${dmMono.variable} ${inter.variable} ${kalnia.variable} font-dm-sans antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
