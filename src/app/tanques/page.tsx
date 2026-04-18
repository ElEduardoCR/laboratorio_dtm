"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { usePermission } from "@/context/AuthContext";
import {
  ArrowLeft,
  Plus,
  Cylinder,
  Truck,
  PackageCheck,
  AlertCircle,
} from "lucide-react";

type Tank = {
  id: string;
  identifier: string;
  current_weight_kg: number;
  initial_weight_kg: number;
  status: "almacen" | "asignado" | "en_proveedor" | "baja";
  current_poi_id: string | null;
  current_pozo_id: string | null;
  poi?: { name: string } | null;
  pozo?: { identifier: string } | null;
};

type Filter = "todos" | "almacen" | "asignado" | "en_proveedor" | "baja";

const STATUS_LABELS: Record<Tank["status"], { label: string; color: string }> =
  {
    almacen: { label: "En Almacén", color: "bg-gray-100 text-gray-700" },
    asignado: { label: "Asignado", color: "bg-green-100 text-green-700" },
    en_proveedor: {
      label: "En Proveedor",
      color: "bg-amber-100 text-amber-700",
    },
    baja: { label: "Dado de Baja", color: "bg-red-100 text-red-700" },
  };

export default function TanquesList() {
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("todos");
  const canSend = usePermission("tanks.out");
  const canReceive = usePermission("tanks.in");
  const canCreate = usePermission("create.tanques");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tanks")
      .select(
        "*, poi:current_poi_id(name), pozo:current_pozo_id(identifier)"
      )
      .order("identifier", { ascending: true });
    setTanks((data as Tank[]) || []);
    setLoading(false);
  };

  const filtered =
    filter === "todos" ? tanks : tanks.filter((t) => t.status === filter);

  const counts = {
    todos: tanks.length,
    almacen: tanks.filter((t) => t.status === "almacen").length,
    asignado: tanks.filter((t) => t.status === "asignado").length,
    en_proveedor: tanks.filter((t) => t.status === "en_proveedor").length,
    baja: tanks.filter((t) => t.status === "baja").length,
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      <Link
        href="/"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar al Panel
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Tanques de Gas-Cloro
          </h1>
          <p className="text-gray-500 mt-1">
            Inventario, asignación y trazabilidad de tanques.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSend && (
            <Link
              href="/tanques/enviar-proveedor"
              className="inline-flex items-center gap-2 bg-white text-amber-700 border-2 border-amber-300 px-4 py-2 rounded-xl font-semibold hover:bg-amber-50 transition-colors"
            >
              <Truck className="w-4 h-4" />
              Enviar a Proveedor
            </Link>
          )}
          {canReceive && (
            <Link
              href="/tanques/recibir-proveedor"
              className="inline-flex items-center gap-2 bg-white text-green-700 border-2 border-green-300 px-4 py-2 rounded-xl font-semibold hover:bg-green-50 transition-colors"
            >
              <PackageCheck className="w-4 h-4" />
              Recibir de Proveedor
            </Link>
          )}
          {canCreate && (
            <Link
              href="/tanques/nuevo"
              className="inline-flex items-center gap-2 bg-dtm-blue text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo Tanque
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(
          [
            ["todos", "Todos"],
            ["almacen", "Almacén"],
            ["asignado", "Asignados"],
            ["en_proveedor", "En Proveedor"],
            ["baja", "Baja"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === key
                ? "bg-dtm-blue text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-dtm-blue"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
          <Cylinder className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No hay tanques en esta categoría.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const pct =
              t.initial_weight_kg > 0
                ? Math.max(
                    0,
                    Math.min(
                      100,
                      Math.round(
                        (t.current_weight_kg / t.initial_weight_kg) * 100
                      )
                    )
                  )
                : 0;
            const lowFuel = pct <= 15 && t.status === "asignado";
            return (
              <Link
                key={t.id}
                href={`/tanques/${t.id}`}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-dtm-blue transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Cylinder className="w-5 h-5 text-dtm-blue" />
                    <h3 className="font-bold text-gray-800">{t.identifier}</h3>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_LABELS[t.status].color}`}
                  >
                    {STATUS_LABELS[t.status].label}
                  </span>
                </div>

                {t.status === "asignado" && (t.poi || t.pozo) && (
                  <p className="text-xs text-gray-500 mb-3">
                    Asignado a{" "}
                    <span className="text-gray-400">
                      ({t.poi ? "Planta" : "Pozo"}):
                    </span>{" "}
                    <span className="font-medium text-gray-700">
                      {t.poi?.name || t.pozo?.identifier}
                    </span>
                  </p>
                )}

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Peso actual</span>
                    <span className="font-semibold text-gray-700">
                      {t.current_weight_kg} / {t.initial_weight_kg} KG
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 ${
                        lowFuel
                          ? "bg-red-500"
                          : pct <= 35
                            ? "bg-amber-500"
                            : "bg-green-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                  {lowFuel && (
                    <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Próximo a agotarse
                    </p>
                  )}
                  {t.status === "almacen" && pct >= 80 && (
                    <p className="text-[11px] text-green-700 font-medium mt-1 flex items-center gap-1">
                      <PackageCheck className="w-3 h-3" />
                      Lleno — listo para asignar
                    </p>
                  )}
                  {t.status === "almacen" && pct <= 35 && (
                    <p className="text-[11px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      Por enviar a proveedor
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
