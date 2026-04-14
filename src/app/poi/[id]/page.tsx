"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import {
  ArrowLeft,
  Edit3,
  Settings,
  AlertTriangle,
  CalendarRange,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";

type Review = {
  id: string;
  review_date: string;
  chlorine_input: number | null;
  chlorine_output: number | null;
  hardness_input: number | null;
  hardness_output: number | null;
  cylinder_weight: number | null;
  observations: string | null;
  photo_chlorine_input: string | null;
  photo_chlorine_output: string | null;
  photo_hardness_input: string | null;
  photo_hardness_output: string | null;
  created_at: string;
};

type FilterType = "diarias" | "semanales" | "mensuales";

export default function POIDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [poi, setPoi] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [monthsLeft, setMonthsLeft] = useState<number>(0);
  const [daysLeft, setDaysLeft] = useState<number>(0);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<FilterType>("diarias");
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);

  useEffect(() => {
    if (id) fetchPoiData();
  }, [id]);

  useEffect(() => {
    if (id) fetchReviews();
  }, [id, filter]);

  const fetchPoiData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("poi")
      .select("*")
      .eq("id", id)
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

  const fetchReviews = async () => {
    setLoadingReviews(true);

    // For all filters, fetch enough reviews to group
    let limit = 10;
    if (filter === "semanales") limit = 70; // ~10 weeks * 7 days
    if (filter === "mensuales") limit = 310; // ~10 months * 31 days

    const { data, error } = await supabase
      .from("daily_reviews")
      .select("*")
      .eq("poi_id", id)
      .order("review_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching reviews:", error);
      setReviews([]);
      setLoadingReviews(false);
      return;
    }

    const allReviews = (data || []) as Review[];

    if (filter === "diarias") {
      setReviews(allReviews.slice(0, 10));
    } else if (filter === "semanales") {
      setReviews(getOnePerWeek(allReviews, 10));
    } else {
      setReviews(getOnePerMonth(allReviews, 10));
    }

    setLoadingReviews(false);
  };

  const getOnePerWeek = (items: Review[], max: number): Review[] => {
    const seen = new Set<string>();
    const result: Review[] = [];
    for (const r of items) {
      const d = new Date(r.review_date + "T00:00:00");
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(r);
        if (result.length >= max) break;
      }
    }
    return result;
  };

  const getOnePerMonth = (items: Review[], max: number): Review[] => {
    const seen = new Set<string>();
    const result: Review[] = [];
    for (const r of items) {
      const key = r.review_date.slice(0, 7); // YYYY-MM
      if (!seen.has(key)) {
        seen.add(key);
        result.push(r);
        if (result.length >= max) break;
      }
    }
    return result;
  };

  const calculateCountdown = (lastFilterChange: string) => {
    if (!lastFilterChange) return;
    const pastDate = new Date(lastFilterChange);
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("es-MX", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
      <Link
        href="/poi"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
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
              {poi.zone === "rural" ? "Zona Rural" : "Zona Urbana"}
            </span>
          </div>
          <div
            className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider ${poi.is_operational ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
          >
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
              <p className="text-xs text-gray-500 font-medium uppercase">
                Entrada
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {poi.chlorine_input !== null ? poi.chlorine_input : "--"}{" "}
                <span className="text-sm font-normal text-gray-500">ppm</span>
              </p>
            </div>
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-500 font-medium uppercase">
                Salida
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {poi.chlorine_output !== null ? poi.chlorine_output : "--"}{" "}
                <span className="text-sm font-normal text-gray-500">ppm</span>
              </p>
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
              <p className="text-xs text-gray-500 font-medium uppercase">
                Suavizador
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {poi.hardness_softener !== null
                  ? poi.hardness_softener
                  : "--"}{" "}
                <span className="text-sm font-normal text-gray-500">ppm</span>
              </p>
            </div>
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-500 font-medium uppercase">
                Producto Final
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {poi.hardness_product !== null ? poi.hardness_product : "--"}{" "}
                <span className="text-sm font-normal text-gray-500">ppm</span>
              </p>
            </div>
          </div>
        </div>

        {/* Filtro de Sedimentos */}
        <div
          className={`bg-white rounded-2xl p-6 shadow-sm border ${expired ? "border-red-300 bg-red-50" : "border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">Filtro Sedimentos</h3>
            {expired ? (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            ) : (
              <CalendarRange className="w-5 h-5 text-blue-500" />
            )}
          </div>

          <div className="h-full flex flex-col justify-center pb-6">
            {expired ? (
              <div className="text-center bg-red-100 text-red-700 p-3 rounded-lg font-semibold">
                Cambio Requerido
              </div>
            ) : (
              <div className="text-center">
                <span className="text-4xl font-bold text-gray-800">
                  {monthsLeft}
                </span>{" "}
                <span className="text-gray-500 mr-2">meses</span>
                <span className="text-4xl font-bold text-gray-800">
                  {daysLeft}
                </span>{" "}
                <span className="text-gray-500">dias</span>
                <p className="text-xs text-gray-400 mt-2 uppercase font-medium">
                  Restantes para cambio
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          Opciones de Mantenimiento
        </h3>
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

      {/* Historial de Revisiones */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          Historial de Revisiones
        </h3>

        {/* Filtros */}
        <div className="flex gap-2 mb-6">
          {(["diarias", "semanales", "mensuales"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setExpandedReview(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-dtm-blue text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Lista de revisiones */}
        {loadingReviews ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dtm-blue"></div>
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            No hay revisiones registradas.
          </p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => {
              const isExpanded = expandedReview === r.id;
              return (
                <div
                  key={r.id}
                  className="border border-gray-100 rounded-xl overflow-hidden"
                >
                  {/* Resumen */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedReview(isExpanded ? null : r.id)
                    }
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">
                        {formatDate(r.review_date)}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                        <span>
                          Cloro: {r.chlorine_input ?? "--"} /{" "}
                          {r.chlorine_output ?? "--"} ppm
                        </span>
                        <span>
                          Dureza: {r.hardness_input ?? "--"} /{" "}
                          {r.hardness_output ?? "--"} ppm
                        </span>
                        {r.cylinder_weight !== null && (
                          <span>Cilindro: {r.cylinder_weight} KG</span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                  </button>

                  {/* Detalle expandido */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                      {/* Valores detallados */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <div className="bg-teal-50 rounded-lg p-3 text-center">
                          <p className="text-[10px] text-teal-600 font-medium uppercase">
                            Cloro Entrada
                          </p>
                          <p className="text-lg font-bold text-teal-800">
                            {r.chlorine_input ?? "--"}
                          </p>
                        </div>
                        <div className="bg-teal-50 rounded-lg p-3 text-center">
                          <p className="text-[10px] text-teal-600 font-medium uppercase">
                            Cloro Salida
                          </p>
                          <p className="text-lg font-bold text-teal-800">
                            {r.chlorine_output ?? "--"}
                          </p>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-3 text-center">
                          <p className="text-[10px] text-indigo-600 font-medium uppercase">
                            Dureza Entrada
                          </p>
                          <p className="text-lg font-bold text-indigo-800">
                            {r.hardness_input ?? "--"}
                          </p>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-3 text-center">
                          <p className="text-[10px] text-indigo-600 font-medium uppercase">
                            Dureza Salida
                          </p>
                          <p className="text-lg font-bold text-indigo-800">
                            {r.hardness_output ?? "--"}
                          </p>
                        </div>
                      </div>

                      {r.observations && (
                        <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg">
                          <span className="font-medium">Observaciones:</span>{" "}
                          {r.observations}
                        </p>
                      )}

                      {/* Fotos */}
                      {(r.photo_chlorine_input ||
                        r.photo_chlorine_output ||
                        r.photo_hardness_input ||
                        r.photo_hardness_output) && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                            Evidencia fotográfica
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              {
                                url: r.photo_chlorine_input,
                                label: "Cloro E",
                              },
                              {
                                url: r.photo_chlorine_output,
                                label: "Cloro S",
                              },
                              {
                                url: r.photo_hardness_input,
                                label: "Dureza E",
                              },
                              {
                                url: r.photo_hardness_output,
                                label: "Dureza S",
                              },
                            ].map(
                              (photo) =>
                                photo.url && (
                                  <a
                                    key={photo.label}
                                    href={photo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <img
                                      src={photo.url}
                                      alt={photo.label}
                                      className="w-full h-24 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition"
                                    />
                                    <p className="text-[10px] text-gray-500 text-center mt-1">
                                      {photo.label}
                                    </p>
                                  </a>
                                )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
