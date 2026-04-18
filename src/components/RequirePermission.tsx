"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import {
  hasPermission,
  useAuth,
  type PermissionKey,
} from "@/context/AuthContext";

export function RequirePermission({
  perm,
  children,
}: {
  perm: PermissionKey | PermissionKey[];
  children: React.ReactNode;
}) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-dtm-blue"></div>
      </div>
    );
  }

  const keys = Array.isArray(perm) ? perm : [perm];
  const allowed = keys.every((k) => hasPermission(profile?.permissions, k));

  if (!allowed) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white border border-amber-200 rounded-2xl p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          Sin permisos para esta sección
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Tu usuario no tiene permisos para acceder. Si crees que es un error,
          contacta al administrador.
        </p>
        <Link
          href="/"
          className="inline-block bg-dtm-blue text-white px-4 py-2 rounded-xl font-semibold text-sm"
        >
          Volver al Panel
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
