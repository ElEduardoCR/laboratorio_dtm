"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { MediaThumb } from "@/components/MediaThumb";
import { usePermission } from "@/context/AuthContext";
import {
  ArrowLeft,
  Droplet,
  MapPin,
  Activity,
  Cylinder,
  Edit3,
  AlertTriangle,
  Wrench,
  ChevronDown,
  ChevronUp,
  DollarSign,
} from "lucide-react";

type Pozo = {
  id: string;
  identifier: string;
  well_number: string | null;
  nickname: string | null;
  kind: "urbano" | "rural" | null;
  chlorination_type: "gas_cloro" | "hipoclorito" | null;
  hipoclorito_qty_kg: number | null;
  is_operational: boolean;
  chlorinator_system: string | null;
  notes: string | null;
  last_chlorine_residual: number | null;
};

type SamplingPoint = { id: string; address: string; position: number };

type Review = {
  id: string;
  review_date: string;
  chlorine_residual: number;
  photo_url: string;
  cylinder_weight: number | null;
  observations: string | null;
  signed_by: string | null;
  signer?: { full_name: string } | null;
};

type Tank = {
  id: string;
  identifier: string;
  current_weight_kg: number;
  initial_weight_kg: number;
};

type MEvent = {
  id: string;
  event_type: string;
  description: string | null;
  status: string;
  created_at: string;
};

type Usage = {
  id: string;
  qty: number;
  total_cost: number;
  description: string | null;
  created_at: string;
  maintenance_event_id: string | null;
  item?: { sku: string; description: string; unit: string } | null;
};

const EVENT_LABELS: Record<string, string> = {
  cloro_alto: "Cloro residual alto",
  cloro_bajo: "Cloro residual bajo",
  clorador_danado: "Sistema clorador dañado",
  otro: "Otro",
};

export default function PozoDetalle() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [pozo, setPozo] = useState<Pozo | null>(null);
  const [points, setPoints] = useState<SamplingPoint[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tank, setTank] = useState<Tank | null>(null);
  const [openEvents, setOpenEvents] = useState<MEvent[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const canDaily = usePermission("reviews.daily");

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    setLoading(true);

    const { data: p } = await supabase
      .from("pozos")
      .select("*")
      .eq("id", id)
      .single();
    if (!p) {
      router.push("/pozos");
      return;
    }
    setPozo(p as Pozo);

    const { data: sp } = await supabase
      .from("pozo_sampling_points")
      .select("id, address, position")
      .eq("pozo_id", id)
      .order("position");
    setPoints((sp as SamplingPoint[]) || []);

    const { data: rs } = await supabase
      .from("well_daily_reviews")
      .select("*")
      .eq("pozo_id", id)
      .order("review_date", { ascending: false })
      .limit(20);
    const rRows = (rs as Review[]) || [];
    const rIds = Array.from(
      new Set(rRows.map((r) => r.signed_by).filter(Boolean))
    ) as string[];
    if (rIds.length) {
      const { data: profs } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", rIds);
      const byId = new Map(
        ((profs as { id: string; full_name: string }[]) || []).map((p) => [
          p.id,
          p,
        ])
      );
      rRows.forEach((r) => {
        if (r.signed_by) {
          const p = byId.get(r.signed_by);
          r.signer = p ? { full_name: p.full_name } : null;
        }
      });
    }
    setReviews(rRows);

    if ((p as Pozo).chlorination_type === "gas_cloro") {
      const { data: t } = await supabase
        .from("tanks")
        .select("id, identifier, current_weight_kg, initial_weight_kg")
        .eq("current_pozo_id", id)
        .eq("status", "asignado")
        .maybeSingle();
      setTank(t as Tank | null);
    } else {
      setTank(null);
    }

    const { data: events } = await supabase
      .from("maintenance_events")
      .select("id, event_type, description, status, created_at")
      .eq("pozo_id", id)
      .neq("status", "cerrado")
      .order("created_at", { ascending: false });
    setOpenEvents((events as MEvent[]) || []);

    const { data: us } = await supabase
      .from("inventory_usages")
      .select(
        "id, qty, total_cost, description, created_at, maintenance_event_id, item:item_id(sku, description, unit)"
      )
      .eq("pozo_id", id)
      .order("created_at", { ascending: false });
    setUsages((us as unknown as Usage[]) || []);

    setLoading(false);
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

  if (loading || !pozo) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dtm-blue"></div>
      </div>
    );
  }

  const tankPct =
    tank && tank.initial_weight_kg > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round((tank.current_weight_kg / tank.initial_weight_kg) * 100)
          )
        )
      : 0;

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <Link
        href="/pozos"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a Pozos
      </Link>

      {/* Cabecera */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Droplet className="w-7 h-7 text-dtm-blue" />
              <h1 className="text-3xl font-bold text-gray-800">
                {pozo.identifier}
              </h1>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {pozo.kind && (
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    pozo.kind === "rural"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-sky-100 text-sky-700"
                  }`}
                >
                  {pozo.kind === "rural"
                    ? "🌾 Rural · hipoclorito"
                    : "🏙️ Urbano · gas-cloro"}
                </span>
              )}
              {pozo.well_number && (
                <span className="text-xs text-gray-500">
                  Pozo #{pozo.well_number}
                </span>
              )}
            </div>
            {points.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
                  Ubicaciones de muestreo
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {points.map((p) => (
                    <li key={p.id} className="flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
                      {p.address}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pozo.chlorinator_system && (
              <p className="text-gray-500 mt-1 text-sm">
                <span className="font-medium text-gray-600">Clorador:</span>{" "}
                {pozo.chlorinator_system}
              </p>
            )}
          </div>
          <div
            className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider ${
              pozo.is_operational
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {pozo.is_operational
              ? "Estado: Operacional"
              : "Estado: Fuera de Servicio"}
          </div>
        </div>
      </div>

      {/* Mantenimiento abierto */}
      {openEvents.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="font-bold text-amber-800">
              Eventos de Mantenimiento Abiertos ({openEvents.length})
            </h2>
          </div>
          <div className="space-y-2">
            {openEvents.map((ev) => (
              <Link
                key={ev.id}
                href="/mantenimiento"
                className="block bg-white rounded-lg p-3 border border-amber-200 hover:border-amber-400 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-amber-900 text-sm">
                      {EVENT_LABELS[ev.event_type] || ev.event_type}
                    </p>
                    {ev.description && (
                      <p className="text-xs text-gray-600 mt-1">
                        {ev.description}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                    {ev.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">Cloro Residual</h3>
            <Activity className="w-5 h-5 text-teal-500" />
          </div>
          <p className="text-4xl font-bold text-gray-800">
            {pozo.last_chlorine_residual !== null
              ? pozo.last_chlorine_residual
              : "--"}{" "}
            <span className="text-lg font-normal text-gray-500">mg/L</span>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Última lectura registrada
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">
              {pozo.chlorination_type === "hipoclorito"
                ? "Hipoclorito Disponible"
                : "Tanque Asignado"}
            </h3>
            <Cylinder className="w-5 h-5 text-dtm-blue" />
          </div>
          {pozo.chlorination_type === "hipoclorito" ? (
            <div>
              <p className="text-2xl font-bold text-gray-800 mb-1">
                {Number(pozo.hipoclorito_qty_kg || 0).toLocaleString("es-MX", {
                  maximumFractionDigits: 2,
                })}{" "}
                KG
              </p>
              <p className="text-xs text-gray-500">
                Reserva actual en el contenedor del pozo. Se actualiza con
                cada relleno registrado en la revisión diaria.
              </p>
            </div>
          ) : tank ? (
            <Link
              href={`/tanques/${tank.id}`}
              className="block hover:opacity-80"
            >
              <p className="text-2xl font-bold text-gray-800 mb-2">
                {tank.identifier}
              </p>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{tank.current_weight_kg} KG</span>
                <span>de {tank.initial_weight_kg} KG</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 ${
                    tankPct <= 15
                      ? "bg-red-500"
                      : tankPct <= 35
                        ? "bg-amber-500"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${tankPct}%` }}
                ></div>
              </div>
            </Link>
          ) : (
            <div>
              <p className="text-gray-400 text-sm mb-2">Sin tanque asignado.</p>
              <Link
                href="/tanques"
                className="text-xs text-dtm-blue hover:underline"
              >
                Asignar uno desde Tanques →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Acciones</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          {canDaily && (
            <Link
              href={`/pozos/${id}/revision-diaria`}
              className="flex-1 flex justify-center items-center gap-2 bg-dtm-blue text-white py-3 px-4 rounded-xl hover:bg-blue-800 font-semibold shadow-sm transition-all"
            >
              <Edit3 className="w-5 h-5" />
              Revisión Diaria
            </Link>
          )}
          <Link
            href="/mantenimiento"
            className="flex-1 flex justify-center items-center gap-2 bg-white text-amber-700 border-2 border-amber-300 py-3 px-4 rounded-xl hover:bg-amber-50 font-semibold transition-all"
          >
            <Wrench className="w-5 h-5" />
            Ver Mantenimiento
          </Link>
        </div>
      </div>

      {/* Cuenta de gasto */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Cuenta de Gasto
          </h3>
          <span className="text-sm text-gray-600">
            Total:{" "}
            <span className="font-bold text-gray-800">
              $
              {usages
                .reduce((a, u) => a + Number(u.total_cost), 0)
                .toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </span>
        </div>
        {usages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Sin material asignado a este pozo.
          </p>
        ) : (
          <div className="space-y-2">
            {usages.map((u) => (
              <div
                key={u.id}
                className="border-t border-gray-100 pt-2 text-sm flex items-start justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {u.item?.sku} · {u.qty} {u.item?.unit}
                    <span className="font-normal text-gray-500 ml-2">
                      ${Number(u.total_cost).toFixed(2)}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {u.item?.description}
                    {" · "}
                    {new Date(u.created_at).toLocaleDateString("es-MX", {
                      timeZone: "America/Mexico_City",
                    })}
                  </p>
                  {u.description && (
                    <p className="text-xs text-gray-600 mt-1">
                      {u.description}
                    </p>
                  )}
                </div>
                {u.maintenance_event_id && (
                  <Link
                    href={`/mantenimiento/${u.maintenance_event_id}`}
                    className="text-xs text-dtm-blue hover:underline shrink-0"
                  >
                    Evento →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          Historial de Revisiones
        </h3>
        {reviews.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            No hay revisiones registradas.
          </p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => {
              const isExpanded = expanded === r.id;
              return (
                <div
                  key={r.id}
                  className="border border-gray-100 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : r.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">
                        {formatDate(r.review_date)}
                      </p>
                      {r.signer?.full_name && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Firmado por: {r.signer.full_name}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                        <span>Cloro: {r.chlorine_residual} mg/L</span>
                        {r.cylinder_weight !== null && (
                          <span>Tanque: {r.cylinder_weight} KG</span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-teal-50 rounded-lg p-3 text-center">
                          <p className="text-[10px] text-teal-600 font-medium uppercase">
                            Cloro Residual
                          </p>
                          <p className="text-lg font-bold text-teal-800">
                            {r.chlorine_residual}{" "}
                            <span className="text-xs font-normal">mg/L</span>
                          </p>
                        </div>
                        {r.cylinder_weight !== null && (
                          <div className="bg-blue-50 rounded-lg p-3 text-center">
                            <p className="text-[10px] text-blue-600 font-medium uppercase">
                              Peso Tanque
                            </p>
                            <p className="text-lg font-bold text-blue-800">
                              {r.cylinder_weight}{" "}
                              <span className="text-xs font-normal">KG</span>
                            </p>
                          </div>
                        )}
                      </div>
                      {r.observations && (
                        <p className="text-sm text-gray-600 mb-3 bg-gray-50 p-3 rounded-lg">
                          <span className="font-medium">Observaciones:</span>{" "}
                          {r.observations}
                        </p>
                      )}
                      {r.photo_url && (
                        <div className="w-full max-w-xs">
                          <MediaThumb
                            url={r.photo_url}
                            label="Evidencia cloro"
                            kind="image"
                            className="w-full max-w-xs h-40 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition"
                          />
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
