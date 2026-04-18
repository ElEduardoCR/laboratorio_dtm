"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function Header() {
  const { session, profile, signOut } = useAuth();
  const pathname = usePathname();

  if (pathname === "/login" || !session) return null;

  const name = profile?.full_name || session.user?.email || "";

  return (
    <header className="w-full border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-dtm-blue text-sm sm:text-base"
        >
          Laboratorio DTM
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-700">
            <UserCircle2 className="w-5 h-5 text-dtm-blue" />
            <span>
              Hola! <span className="font-semibold">{name}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-red-600 border border-gray-200 hover:border-red-300 px-3 py-1.5 rounded-lg"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
