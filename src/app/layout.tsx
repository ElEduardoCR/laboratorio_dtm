import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Laboratorio DTM - Sistema de Gestión",
  description: "Sistema de Gestión Administrativa para Laboratorio DTM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white">


        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-8 flex flex-col">
          {children}
        </main>

        <footer className="bg-dtm-blue text-white w-full p-4 text-center mt-auto">
          <p>&copy; {new Date().getFullYear()} Laboratorio DTM. Todos los derechos reservados.</p>
        </footer>
      </body>
    </html>
  );
}
