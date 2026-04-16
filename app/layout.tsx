import type { Metadata } from "next";
import { Inter, Bangers, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const bangers = Bangers({
  variable: "--font-bangers",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Party Animals",
  description: "Draw your party animal. AI brings it to life. The wall never forgets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", inter.variable, bangers.variable, "font-sans", geist.variable)}
    >
      <body className="h-dvh flex flex-col bg-[#08080f] text-[#f0f0f8] overflow-hidden">
        {children}
      </body>
    </html>
  );
}
