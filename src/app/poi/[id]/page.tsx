"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { ArrowLeft, Edit3, Settings, AlertTriangle, CalendarRange, Activity } from "lucide-react";
import Link from "next/link";

export default function POIDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  
  const [poi, setPoi] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Time remaining states
  const [monthsLeft, setMonthsLeft] = useState<number>(0);
  const [daysLeft, setDaysLeft] = useState<number>(0);

  useEffect(() => {
    if (id) {
      fetchPoiData();
    }
  }, [id]);

  const fetchPoiData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('poi')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error("Error fetching POI", error);
      router.push("/poi");
    } else {
      setPoi(data);
      calculateCountdown(data.last_filter_change);
    }
    setLoading(false);
  };

  const calculateCountdown = (lastFilterChange: string) => {
    if (!lastFilterChange) return;
    const pastDate = new Date(lastFilterChange);
    // 6 months limit
    const expirationDate = new Date(pastDate);
    expirationDate.setMonth(expirationDate.getMonth() + 6);
    
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    
    if (diffTime <= 0) {
      setMonthsLeft(0);
      setDaysLeft(0);
      return;
    }

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setMonthsLeft(Math.floor(diffDays / 30));
    setDaysLeft(diffDays % 30);
  };



  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dtm-blue"></div>
      </div>
    );
  }

  if (!poi) return null;

  const expired = monthsLeft === 0 && daysLeft === 0;

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <Link href="/poi" className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a Plantas
      </Link>

      {/* Cabecera */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{poi.name}</h1>
            <p className="text-gray-500 mt-1 flex items-center">
              {poi.location}
            </p>
            <span
              className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                poi.zone === "rural"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-sky-100 text-sky-700"
              }`}
            >
              {poi.zone === "rural" ? "🌾 Zona Rural" : "🏙️ Zona Urbana"}
            </span>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider ${poi.is_operational ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {poi.is_operational ? "Estado: Operacional" : "Estado: Inactiva"}
          </div>
        </div>
      </div>

      {/* Grid de Metricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Lecturas de Cloro */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">Cloro</h3>
            <Activity className="w-5 h-5 text-teal-500" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase">Entrada</p>
              <p className="text-2xl font-bold text-gray-800">{poi.chlorine_input !== null ? poi.chlorine_input : "--"} <span className="text-sm font-normal text-gray-500">ppm</span></p>
            </div>
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-500 font-medium uppercase">Salida</p>
              <p className="text-2xl font-bold text-gray-800">{poi.chlorine_output !== null ? poi.chlorine_output : "--"} <span className="text-sm font-normal text-gray-500">ppm</span></p>
            </div>
          </div>
        </div>

        {/* Dureza */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">Dureza</h3>
            <Settings className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase">Suavizador</p>
              <p className="text-2xl font-bold text-gray-800">{poi.hardness_softener !== null ? poi.hardness_softener : "--"} <span className="text-sm font-normal text-gray-500">ppm</span></p>
            </div>
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-500 font-medium uppercase">Producto Final</p>
              <p className="text-2xl font-bold text-gray-800">{poi.hardness_product !== null ? poi.hardness_product : "--"} <span className="text-sm font-normal text-gray-500">ppm</span></p>
            </div>
          </div>
        </div>

        {/* Filtro de Sedimentos */}
        <div className={`bg-white rounded-2xl p-6 shadow-sm border ${expired ? 'border-red-300 bg-red-50' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">Filtro Sedimentos</h3>
            {expired ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <CalendarRange className="w-5 h-5 text-blue-500" />}
          </div>
          
          <div className="h-full flex flex-col justify-center pb-6">
            {expired ? (
              <div className="text-center bg-red-100 text-red-700 p-3 rounded-lg font-semibold">
                ¡Cambio Requerido!
              </div>
            ) : (
              <div className="text-center">
                <span className="text-4xl font-bold text-gray-800">{monthsLeft}</span> <span className="text-gray-500 mr-2">meses</span>
                <span className="text-4xl font-bold text-gray-800">{daysLeft}</span> <span className="text-gray-500">días</span>
                <p className="text-xs text-gray-400 mt-2 uppercase font-medium">Restantes para cambio</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Acciones */}
      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Opciones de Mantenimiento</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href={`/poi/${id}/revision-diaria`}
            className="flex-1 flex justify-center items-center gap-2 bg-dtm-blue text-white py-3 px-4 rounded-xl hover:bg-blue-800 font-semibold shadow-sm transition-all"
          >
            <Edit3 className="w-5 h-5" />
            Revisión Diaria
          </Link>
          <Link
            href={`/poi/${id}/revision-semanal`}
            className="flex-1 flex justify-center items-center gap-2 bg-white text-dtm-blue border-2 border-dtm-blue py-3 px-4 rounded-xl hover:bg-blue-50 font-semibold shadow-sm transition-all"
          >
            <Settings className="w-5 h-5" />
            Revisión Semanal
          </Link>
        </div>
      </div>

    </div>
  );
}
