"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const PUBLIC_PATHS = ["/login"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!session && !isPublic) {
      router.replace("/login");
    } else if (session && pathname === "/login") {
      router.replace("/");
    }
  }, [loading, session, isPublic, pathname, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-dtm-blue"></div>
      </div>
    );
  }

  if (!session && !isPublic) return null;

  if (session && profile && !profile.is_active) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white border border-red-200 rounded-2xl p-6 text-center">
        <h1 className="text-xl font-bold text-red-700 mb-2">
          Cuenta desactivada
        </h1>
        <p className="text-sm text-gray-600">
          Tu cuenta no está habilitada para usar el sistema. Contacta al
          administrador.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
