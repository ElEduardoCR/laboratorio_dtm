"use client";

import Link from "next/link";
import { Activity, Droplet, Wrench, Cylinder, Box, DollarSign } from "lucide-react";
import { hasPermission, useAuth, type PermissionKey } from "@/context/AuthContext";

type Mod = {
  id: string;
  name: string;
  icon: React.ReactNode;
  href: string;
  description: string;
  perm: PermissionKey;
};

export default function Home() {
  const { profile } = useAuth();

  const modules: Mod[] = [
    {
      id: "poi",
      name: "Plantas de Ósmosis Inversa",
      icon: <Activity className="w-8 h-8 md:w-12 md:h-12 mb-4 text-dtm-blue group-hover:scale-110 transition-transform duration-300" />,
      href: "/poi",
      description: "Manejo y métricas de POI",
      perm: "modules.poi",
    },
    {
      id: "pozos",
      name: "Pozos",
      icon: <Droplet className="w-8 h-8 md:w-12 md:h-12 mb-4 text-dtm-blue group-hover:scale-110 transition-transform duration-300" />,
      href: "/pozos",
      description: "Registro y revisión diaria de pozos",
      perm: "modules.pozos",
    },
    {
      id: "mantenimiento",
      name: "Eventos de Mantenimiento",
      icon: <Wrench className="w-8 h-8 md:w-12 md:h-12 mb-4 text-amber-600 group-hover:scale-110 transition-transform duration-300" />,
      href: "/mantenimiento",
      description: "Incidencias abiertas y resueltas",
      perm: "modules.mantenimiento",
    },
    {
      id: "cilindros",
      name: "Tanques de Gas-Cloro",
      icon: <Cylinder className="w-8 h-8 md:w-12 md:h-12 mb-4 text-dtm-blue group-hover:scale-110 transition-transform duration-300" />,
      href: "/tanques",
      description: "Inventario y trazabilidad de tanques",
      perm: "modules.tanques",
    },
    {
      id: "inventario",
      name: "Inventario",
      icon: <Box className="w-8 h-8 md:w-12 md:h-12 mb-4 text-dtm-blue group-hover:scale-110 transition-transform duration-300" />,
      href: "/inventario",
      description: "SKUs, entradas y uso de material",
      perm: "modules.inventario",
    },
    {
      id: "recaudacion",
      name: "Recaudación",
      icon: <DollarSign className="w-8 h-8 md:w-12 md:h-12 mb-4 text-green-600 group-hover:scale-110 transition-transform duration-300" />,
      href: "/recaudacion",
      description: "Ingresos semanales y mensuales por POI",
      perm: "modules.recaudacion",
    },
  ];

  const visible = modules.filter((m) =>
    hasPermission(profile?.permissions, m.perm)
  );

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Panel Principal</h1>
      <p className="text-gray-500 mb-8">Seleccione un módulo para gestionar o revisar el estado del sistema.</p>

      {visible.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-amber-800 font-medium">
            Tu usuario no tiene acceso a ningún módulo. Contacta al administrador.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((mod) => (
            <Link key={mod.id} href={mod.href} className="group flex flex-col items-center justify-center p-8 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl hover:border-dtm-blue transition-all duration-300">
              {mod.icon}
              <h2 className="text-lg md:text-xl font-semibold text-gray-800 text-center">{mod.name}</h2>
              <p className="text-sm text-gray-500 mt-2 text-center">{mod.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
