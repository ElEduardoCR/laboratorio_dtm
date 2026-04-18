"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Droplet,
  MapPin,
  Activity,
} from "lucide-react";
import { supabase } from "@/utils/supabase/client";

type Pozo = {
  id: string;
  identifier: string;
  is_operational: boolean;
  address: string | null;
  last_chlorine_residual: number | null;
};

export default function PozosList() {
  const [pozos, setPozos] = useState<Pozo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pozos")
      .select("id, identifier, is_operational, address, last_chlorine_residual")
      .order("identifier");
    setPozos((data as Pozo[]) || []);
    setLoading(false);
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
          <h1 className="text-3xl font-bold text-gray-800">Pozos</h1>
          <p className="text-gray-500 mt-1">
            Gestión y monitoreo de cloración en pozos.
          </p>
        </div>
        <Link
          href="/pozos/nuevo"
          className="inline-flex items-center gap-2 bg-dtm-blue text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo Pozo
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-dtm-blue"></div>
        </div>
      ) : pozos.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
          <Droplet className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No hay pozos registrados.</p>
          <Link
            href="/pozos/nuevo"
            className="inline-flex items-center gap-2 mt-4 text-dtm-blue hover:underline font-medium"
          >
            <Plus className="w-4 h-4" />
            Registrar el primero
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pozos.map((p) => (
            <Link
              key={p.id}
              href={`/pozos/${p.id}`}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-dtm-blue transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Droplet className="w-5 h-5 text-dtm-blue" />
                  <h3 className="font-bold text-gray-800">{p.identifier}</h3>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    p.is_operational
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {p.is_operational ? "Operacional" : "Fuera Serv."}
                </span>
              </div>

              {p.address && (
                <p className="text-xs text-gray-500 mb-3 flex items-start gap-1">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{p.address}</span>
                </p>
              )}

              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-500" />
                  <span className="text-xs text-gray-500">Cloro residual</span>
                </div>
                <span className="text-sm font-bold text-gray-800">
                  {p.last_chlorine_residual !== null
                    ? `${p.last_chlorine_residual} mg/L`
                    : "--"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
