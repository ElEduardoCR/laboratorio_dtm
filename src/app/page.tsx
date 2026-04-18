import Link from "next/link";
import { Activity, Droplet, Wrench, Cylinder, Box, DollarSign } from "lucide-react";

export default function Home() {
  const modules = [
    {
      id: "poi",
      name: "Plantas de Ósmosis Inversa",
      icon: <Activity className="w-8 h-8 md:w-12 md:h-12 mb-4 text-dtm-blue group-hover:scale-110 transition-transform duration-300" />,
      href: "/poi",
      active: true,
      description: "Manejo y métricas de POI"
    },
    {
      id: "pozos",
      name: "Pozos",
      icon: <Droplet className="w-8 h-8 md:w-12 md:h-12 mb-4 text-dtm-blue group-hover:scale-110 transition-transform duration-300" />,
      href: "/pozos",
      active: true,
      description: "Registro y revisión diaria de pozos"
    },
    {
      id: "mantenimiento",
      name: "Eventos de Mantenimiento",
      icon: <Wrench className="w-8 h-8 md:w-12 md:h-12 mb-4 text-amber-600 group-hover:scale-110 transition-transform duration-300" />,
      href: "/mantenimiento",
      active: true,
      description: "Incidencias abiertas y resueltas"
    },
    {
      id: "cilindros",
      name: "Tanques de Gas-Cloro",
      icon: <Cylinder className="w-8 h-8 md:w-12 md:h-12 mb-4 text-dtm-blue group-hover:scale-110 transition-transform duration-300" />,
      href: "/tanques",
      active: true,
      description: "Inventario y trazabilidad de tanques"
    },
    {
      id: "inventario",
      name: "Inventario",
      icon: <Box className="w-8 h-8 md:w-12 md:h-12 mb-4 text-dtm-blue group-hover:scale-110 transition-transform duration-300" />,
      href: "/inventario",
      active: true,
      description: "SKUs, entradas y uso de material"
    },
    {
      id: "recaudacion",
      name: "Recaudación",
      icon: <DollarSign className="w-8 h-8 md:w-12 md:h-12 mb-4 text-gray-400" />,
      href: "#",
      active: false,
      description: "Próximamente"
    }
  ];

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Panel Principal</h1>
      <p className="text-gray-500 mb-8">Seleccione un módulo para gestionar o revisar el estado del sistema.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((mod) => (
          mod.active ? (
            <Link key={mod.id} href={mod.href} className="group flex flex-col items-center justify-center p-8 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl hover:border-dtm-blue transition-all duration-300">
              {mod.icon}
              <h2 className="text-lg md:text-xl font-semibold text-gray-800 text-center">{mod.name}</h2>
              <p className="text-sm text-gray-500 mt-2 text-center">{mod.description}</p>
            </Link>
          ) : (
            <div key={mod.id} className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-100 rounded-2xl opacity-70 cursor-not-allowed">
              {mod.icon}
              <h2 className="text-lg md:text-xl font-semibold text-gray-500 text-center">{mod.name}</h2>
              <span className="mt-3 px-3 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded-full uppercase tracking-widest">{mod.description}</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
