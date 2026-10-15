import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet-context";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nogal Casino Royale | Casino Virtual Online",
  description:
    "El casino virtual más emocionante: Ruleta, Blackjack, Crash, Minas, Slots 777, Plinko, Video Poker, Dados, Baccarat y Mega Wheel. Fichas de cortesía y diversión 100% segura.",
  keywords: ["casino virtual", "ruleta online", "blackjack", "crash", "plinko", "tragamonedas", "casino games"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full dark antialiased`}
    >
      <body className="min-h-full bg-[#0a0c10] text-neutral-100 flex flex-col selection:bg-amber-500 selection:text-black">
        <WalletProvider>
          <Navbar />
          <main className="flex-1 flex flex-col">{children}</main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
