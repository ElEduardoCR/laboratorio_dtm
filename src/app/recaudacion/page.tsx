"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Trophy,
} from "lucide-react";

type Poi = {
  id: string;
  name: string;
  location: string;
  is_operational: boolean;
};

type WR = {
  id: string;
  poi_id: string;
  review_date: string;
  collection_amount: number | null;
};

function fmt(n: number) {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });
}

// ISO-week helpers in America/Mexico_City (approx via local -> string; good enough for CDMX users)
function getWeekStart(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
}

export default function Recaudacion() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [reviews, setReviews] = useState<WR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, dr, wr] = await Promise.all([
        supabase
          .from("poi")
          .select("id, name, location, is_operational")
          .order("name"),
        supabase
          .from("daily_reviews")
          .select("id, poi_id, review_date, collection_amount")
          .not("collection_amount", "is", null)
          .order("review_date", { ascending: false }),
        // Legacy: revisiones semanales antiguas que aún tienen recaudación
        supabase
          .from("weekly_reviews")
          .select("id, poi_id, review_date, collection_amount")
          .not("collection_amount", "is", null)
          .order("review_date", { ascending: false }),
      ]);
      setPois((p.data as Poi[]) || []);
      const merged = [
        ...(((dr.data as WR[]) || [])),
        ...(((wr.data as WR[]) || [])),
      ].sort((a, b) => (a.review_date < b.review_date ? 1 : -1));
      setReviews(merged);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = getWeekStart(now);
    const weekStartStr = ymd(weekStart);
    const todayStr = ymd(now);
    const currentMonth = monthKey(todayStr);

    const weekReviews = reviews.filter(
      (r) => r.review_date >= weekStartStr && r.review_date <= todayStr
    );
    const monthReviews = reviews.filter(
      (r) => monthKey(r.review_date) === currentMonth
    );

    const weekTotal = weekReviews.reduce(
      (a, r) => a + Number(r.collection_amount || 0),
      0
    );
    const monthTotal = monthReviews.reduce(
      (a, r) => a + Number(r.collection_amount || 0),
      0
    );
    const yearTotal = reviews
      .filter((r) => r.review_date.startsWith(todayStr.slice(0, 4)))
      .reduce((a, r) => a + Number(r.collection_amount || 0), 0);

    const reportedPoiIds = new Set(weekReviews.map((r) => r.poi_id));
    const operationalPois = pois.filter((p) => p.is_operational);
    const pendingPois = operationalPois.filter(
      (p) => !reportedPoiIds.has(p.id)
    );

    // Ranking mensual por POI
    const byPoiMonth = new Map<string, number>();
    for (const r of monthReviews) {
      byPoiMonth.set(
        r.poi_id,
        (byPoiMonth.get(r.poi_id) || 0) + Number(r.collection_amount || 0)
      );
    }
    const ranking = pois
      .map((p) => ({
        poi: p,
        weekAmount: weekReviews
          .filter((r) => r.poi_id === p.id)
          .reduce((a, r) => a + Number(r.collection_amount || 0), 0),
        monthAmount: byPoiMonth.get(p.id) || 0,
        yearAmount: reviews
          .filter(
            (r) =>
              r.poi_id === p.id &&
              r.review_date.startsWith(todayStr.slice(0, 4))
          )
          .reduce((a, r) => a + Number(r.collection_amount || 0), 0),
      }))
      .sort((a, b) => b.monthAmount - a.monthAmount);

    // Tendencia últimos 8 semanas
    const trend: { weekStart: string; total: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(weekStart);
      ws.setDate(ws.getDate() - i * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      const sum = reviews
        .filter(
          (r) => r.review_date >= ymd(ws) && r.review_date <= ymd(we)
        )
        .reduce((a, r) => a + Number(r.collection_amount || 0), 0);
      trend.push({ weekStart: ymd(ws), total: sum });
    }

    const avgPerOperationalPoi =
      operationalPois.length > 0 ? weekTotal / operationalPois.length : 0;

    const best = ranking[0];

    return {
      weekStart: weekStartStr,
      weekTotal,
      monthTotal,
      yearTotal,
      pendingPois,
      operationalPois,
      ranking,
      trend,
      avgPerOperationalPoi,
      best,
      weekReviewsCount: weekReviews.length,
      monthReviewsCount: monthReviews.length,
    };
  }, [pois, reviews]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-dtm-blue"></div>
      </div>
    );
  }

  const maxTrend = Math.max(1, ...stats.trend.map((t) => t.total));

  return (
    <div className="w-full max-w-6xl mx-auto py-8">
      <Link
        href="/"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar al Panel
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-green-600" />
          Recaudación
        </h1>
        <p className="text-gray-500 mt-1">
          Resumen semanal y mensual basado en las recaudaciones registradas
          en la revisión diaria de cada planta.
        </p>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Esta semana"
          value={fmt(stats.weekTotal)}
          hint={`${stats.weekReviewsCount} de ${stats.operationalPois.length} POI`}
          icon={<Calendar className="w-4 h-4" />}
          color="text-green-700"
        />
        <MetricCard
          label="Este mes"
          value={fmt(stats.monthTotal)}
          hint={`${stats.monthReviewsCount} reportes`}
          icon={<TrendingUp className="w-4 h-4" />}
          color="text-dtm-blue"
        />
        <MetricCard
          label="Acumulado anual"
          value={fmt(stats.yearTotal)}
          hint={new Date().getFullYear().toString()}
          icon={<Activity className="w-4 h-4" />}
          color="text-gray-700"
        />
        <MetricCard
          label="Promedio por POI (semana)"
          value={fmt(stats.avgPerOperationalPoi)}
          hint={`${stats.operationalPois.length} operacionales`}
          icon={<Activity className="w-4 h-4" />}
          color="text-amber-700"
        />
      </div>

      {/* Destacado */}
      {stats.best && stats.best.monthAmount > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <Trophy className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-xs uppercase font-bold text-amber-700">
              POI con mayor recaudación este mes
            </p>
            <p className="font-semibold text-gray-800">
              {stats.best.poi.name}{" "}
              <span className="text-amber-700">
                · {fmt(stats.best.monthAmount)}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Pendientes de la semana */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Pendientes esta semana ({stats.pendingPois.length})
          </h2>
          <span className="text-xs text-gray-500">
            Semana del{" "}
            {new Date(stats.weekStart + "T12:00:00").toLocaleDateString(
              "es-MX",
              { day: "numeric", month: "short" }
            )}
          </span>
        </div>
        {stats.pendingPois.length === 0 ? (
          <p className="text-sm text-green-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Todas las POI operacionales reportaron esta semana.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.pendingPois.map((p) => (
              <Link
                key={p.id}
                href={`/poi/${p.id}/revision-diaria`}
                className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-full hover:bg-amber-100"
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Tendencia 8 semanas */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-dtm-blue" />
          Tendencia últimas 8 semanas
        </h2>
        <div className="flex items-end gap-2 h-40">
          {stats.trend.map((t, i) => {
            const pct = Math.round((t.total / maxTrend) * 100);
            const isCurrent = i === stats.trend.length - 1;
            return (
              <div
                key={t.weekStart}
                className="flex-1 flex flex-col items-center gap-1"
                title={`${t.weekStart} · ${fmt(t.total)}`}
              >
                <div className="w-full h-full flex items-end">
                  <div
                    className={`w-full rounded-t-md ${
                      isCurrent ? "bg-dtm-blue" : "bg-blue-200"
                    }`}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-gray-500">
                  {new Date(t.weekStart + "T12:00:00").toLocaleDateString(
                    "es-MX",
                    { day: "numeric", month: "short" }
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ranking por POI */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <h2 className="font-bold text-gray-800 p-5 pb-3">
          Ranking mensual por POI
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">POI</th>
              <th className="px-4 py-3 text-right">Semana</th>
              <th className="px-4 py-3 text-right">Mes</th>
              <th className="px-4 py-3 text-right">Año</th>
            </tr>
          </thead>
          <tbody>
            {stats.ranking.map((row, idx) => (
              <tr
                key={row.poi.id}
                className="border-t border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-gray-500 font-semibold">
                  {idx + 1}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/poi/${row.poi.id}`}
                    className="font-semibold text-gray-800 hover:text-dtm-blue hover:underline"
                  >
                    {row.poi.name}
                  </Link>
                  <p className="text-xs text-gray-500">{row.poi.location}</p>
                  {!row.poi.is_operational && (
                    <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                      Fuera de servicio
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {row.weekAmount > 0 ? (
                    fmt(row.weekAmount)
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                  {row.monthAmount > 0 ? (
                    fmt(row.monthAmount)
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {row.yearAmount > 0 ? (
                    fmt(row.yearAmount)
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100">
      <p className={`text-xs font-medium inline-flex items-center gap-1 ${color}`}>
        {icon}
        {label}
      </p>
      <p className="text-xl md:text-2xl font-bold text-gray-800 mt-1">
        {value}
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>
    </div>
  );
}
