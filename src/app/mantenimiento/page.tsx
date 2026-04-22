"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowLeft,
  Wrench,
  AlertTriangle,
  Droplet,
  Activity,
  CheckCircle2,
  Clock,
  Plus,
} from "lucide-react";

type MEvent = {
  id: string;
  source_type: "pozo" | "poi";
  pozo_id: string | null;
  poi_id: string | null;
  event_type: string;
  custom_title: string | null;
  description: string | null;
  status: "abierto" | "en_proceso" | "cerrado";
  created_at: string;
  resolved_at: string | null;
  pozo?: { identifier: string } | null;
  poi?: { name: string } | null;
};

type Filter = "abierto" | "en_proceso" | "cerrado" | "todos";

const EVENT_LABELS: Record<string, string> = {
  cloro_alto: "Cloro residual alto",
  cloro_bajo: "Cloro residual bajo",
  clorador_danado: "Sistema clorador dañado",
  otro: "Otro",
};

const STATUS_LABELS: Record<
  MEvent["status"],
  { label: string; color: string; icon: typeof Clock }
> = {
  abierto: {
    label: "Abierto",
    color: "bg-red-100 text-red-700",
    icon: AlertTriangle,
  },
  en_proceso: {
    label: "En proceso",
    color: "bg-amber-100 text-amber-700",
    icon: Clock,
  },
  cerrado: {
    label: "Cerrado",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
};

export default function MantenimientoList() {
  const { profile } = useAuth();
  const canManage = !!profile?.permissions.maintenance?.assign;
  const [events, setEvents] = useState<MEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("abierto");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("maintenance_events")
      .select(
        "*, pozo:pozo_id(identifier), poi:poi_id(name)"
      )
      .order("created_at", { ascending: false });
    setEvents((data as MEvent[]) || []);
    setLoading(false);
  };

  const filtered =
    filter === "todos" ? events : events.filter((e) => e.status === filter);

  const counts = {
    todos: events.length,
    abierto: events.filter((e) => e.status === "abierto").length,
    en_proceso: events.filter((e) => e.status === "en_proceso").length,
    cerrado: events.filter((e) => e.status === "cerrado").length,
  };

  const updateStatus = async (
    id: string,
    newStatus: MEvent["status"]
  ) => {
    setUpdating(id);
    const updates: Record<string, string | null> = { status: newStatus };
    if (newStatus === "cerrado") {
      updates.resolved_at = new Date().toISOString();
    } else {
      updates.resolved_at = null;
    }
    await supabase.from("maintenance_events").update(updates).eq("id", id);
    setUpdating(null);
    load();
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

      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Wrench className="w-7 h-7 text-amber-600" />
            Eventos de Mantenimiento
          </h1>
          <p className="text-gray-500 mt-1">
            Incidencias generadas en revisiones de pozos y plantas.
          </p>
        </div>
        {canManage && (
          <Link
            href="/mantenimiento/nuevo"
            className="inline-flex items-center gap-1 bg-dtm-blue text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-blue-800 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Evento
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(
          [
            ["abierto", "Abiertos"],
            ["en_proceso", "En proceso"],
            ["cerrado", "Cerrados"],
            ["todos", "Todos"],
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
          <Wrench className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No hay eventos en esta categoría.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const StatusIcon = STATUS_LABELS[e.status].icon;
            const sourceHref =
              e.source_type === "pozo" && e.pozo_id
                ? `/pozos/${e.pozo_id}`
                : e.source_type === "poi" && e.poi_id
                  ? `/poi/${e.poi_id}`
                  : null;
            const sourceLabel =
              e.pozo?.identifier || e.poi?.name || "Sin origen";
            return (
              <div
                key={e.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${STATUS_LABELS[e.status].color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {STATUS_LABELS[e.status].label}
                      </span>
                      <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                        {e.source_type === "pozo" ? (
                          <Droplet className="w-3 h-3" />
                        ) : (
                          <Activity className="w-3 h-3" />
                        )}
                        {sourceHref ? (
                          <Link
                            href={sourceHref}
                            className="hover:underline text-dtm-blue"
                          >
                            {sourceLabel}
                          </Link>
                        ) : (
                          <span>{sourceLabel}</span>
                        )}
                      </span>
                    </div>
                    <Link
                      href={`/mantenimiento/${e.id}`}
                      className="font-semibold text-gray-800 hover:text-dtm-blue hover:underline block"
                    >
                      {e.event_type === "otro" && e.custom_title
                        ? e.custom_title
                        : EVENT_LABELS[e.event_type] || e.event_type}
                    </Link>
                    {e.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {e.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Creado:{" "}
                      {new Date(e.created_at).toLocaleString("es-MX", {
                        timeZone: "America/Mexico_City",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {e.resolved_at &&
                        ` · Resuelto: ${new Date(e.resolved_at).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {e.status === "abierto" && (
                      <button
                        disabled={updating === e.id}
                        onClick={() => updateStatus(e.id, "en_proceso")}
                        className="px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg disabled:opacity-50"
                      >
                        Tomar
                      </button>
                    )}
                    {e.status !== "cerrado" && (
                      <button
                        disabled={updating === e.id}
                        onClick={() => updateStatus(e.id, "cerrado")}
                        className="px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 rounded-lg disabled:opacity-50"
                      >
                        Cerrar
                      </button>
                    )}
                    {e.status === "cerrado" && canManage && (
                      <button
                        disabled={updating === e.id}
                        onClick={() => updateStatus(e.id, "abierto")}
                        className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                      >
                        Reabrir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
