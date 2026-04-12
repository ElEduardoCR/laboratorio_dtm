"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, MapPin, Activity } from "lucide-react";
import { supabase } from "@/utils/supabase/client";

export default function POIList() {
  const [pois, setPois] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPois();
  }, []);

  const fetchPois = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("poi")
      .select("id, name, location, is_operational, zone")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching POIs", error);
    } else {
      setPois(data || []);
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Plantas de Ósmosis Inversa
          </h1>
          <p className="text-gray-500">
            Gestión de plantas, métricas y mantenimientos.
          </p>
        </div>
        <Link
          href="/poi/nueva"
          className="flex items-center gap-2 bg-dtm-blue text-white px-5 py-3 rounded-lg hover:bg-blue-800 transition-colors shadow-md font-medium"
        >
          <PlusCircle className="w-5 h-5" />
          Añadir Nueva Planta
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dtm-blue"></div>
        </div>
      ) : pois.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-600">
            No hay plantas registradas
          </h3>
          <p className="text-gray-500 max-w-md mx-auto mt-2">
            Agrega nuevas plantas de ósmosis inversa para comenzar a registrar
            sus lecturas de cloro y dureza.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pois.map((poi) => (
            <Link
              key={poi.id}
              href={`/poi/${poi.id}`}
              className="bg-white border text-gray-800 border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-lg transition-all hover:border-dtm-blue group"
            >
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-xl font-bold text-gray-800 group-hover:text-dtm-blue transition-colors break-words max-w-[70%]">
                  {poi.name}
                </h2>
                <div
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    poi.is_operational
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {poi.is_operational ? "Operacional" : "Inactiva"}
                </div>
              </div>
              <div className="flex items-center text-gray-500 text-sm mb-2">
                <MapPin className="w-4 h-4 mr-2 shrink-0" />
                {poi.location}
              </div>
              <span
                className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                  poi.zone === "rural"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-sky-100 text-sky-700"
                }`}
              >
                {poi.zone === "rural" ? "🌾 Rural" : "🏙️ Urbana"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
