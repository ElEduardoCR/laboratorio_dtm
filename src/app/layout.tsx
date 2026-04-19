import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { POLYFILL_SCRIPT } from "./polyfills";
import { AuthProvider } from "@/context/AuthContext";
import { AuthGate } from "@/components/AuthGate";
import { Header } from "@/components/Header";

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: POLYFILL_SCRIPT }} />
      </head>
      <body
        className="min-h-full flex flex-col bg-white bg-no-repeat bg-center bg-fixed"
        style={{
          backgroundImage: "url('/logos/logo.webp')",
          backgroundSize: "min(70vw, 700px)",
          backgroundBlendMode: "lighten",
        }}
      >
        <div className="min-h-full flex flex-col flex-1 bg-white/85">
          <AuthProvider>
            <Header />
            <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-8 flex flex-col">
              <AuthGate>{children}</AuthGate>
            </main>
            <footer className="bg-dtm-blue text-white w-full p-4 text-center mt-auto">
              <p>&copy; {new Date().getFullYear()} Junta Municipal de Agua y Saneamiento de Delicias - Dirección Técnica Municipal. Todos los derechos reservados.</p>
            </footer>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
