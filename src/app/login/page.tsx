"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(
        error.toLowerCase().includes("invalid")
          ? "Usuario o contraseña incorrectos."
          : error
      );
      return;
    }
    router.replace("/");
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center w-full max-w-5xl">
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <Image
            src="/logos/logo.webp"
            alt="Junta Municipal de Agua"
            width={520}
            height={520}
            priority
            className="w-72 sm:w-96 md:w-[28rem] lg:w-[32rem] h-auto"
          />
          <h1 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-bold text-dtm-blue leading-tight">
            Dirección Técnica Municipal
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 w-full max-w-sm md:justify-self-end">
          <h2 className="text-xl font-bold text-gray-800 mb-1">
            Inicia sesión
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Accede al sistema con tus credenciales.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usuario
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-dtm-blue"
                  placeholder="correo@laboratorio.mx"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-dtm-blue"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-dtm-blue text-white font-semibold py-2.5 rounded-xl hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="text-[11px] text-gray-400 text-center mt-6">
            Las cuentas son administradas por el equipo de TI. Contacta al
            administrador para altas o cambios de contraseña.
          </p>
        </div>
      </div>
    </div>
  );
}
