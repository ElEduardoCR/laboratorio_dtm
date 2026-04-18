"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { usePermission } from "@/context/AuthContext";
import {
  ArrowLeft,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplet,
  Activity,
  Box,
  Plus,
  Trash2,
} from "lucide-react";

type MEvent = {
  id: string;
  source_type: "pozo" | "poi";
  pozo_id: string | null;
  poi_id: string | null;
  event_type: string;
  description: string | null;
  status: "abierto" | "en_proceso" | "cerrado";
  created_at: string;
  resolved_at: string | null;
  pozo?: { identifier: string } | null;
  poi?: { name: string } | null;
};

type Item = {
  id: string;
  sku: string;
  description: string;
  unit: string;
  price: number;
  current_qty: number;
};

type Usage = {
  id: string;
  item_id: string;
  qty: number;
  unit_price_snapshot: number;
  total_cost: number;
  description: string | null;
  created_at: string;
  item?: { sku: string; description: string; unit: string } | null;
};

const EVENT_LABELS: Record<string, string> = {
  cloro_alto: "Cloro residual alto",
  cloro_bajo: "Cloro residual bajo",
  clorador_danado: "Sistema clorador dañado",
  otro: "Otro",
};

const STATUS_COLORS: Record<MEvent["status"], string> = {
  abierto: "bg-red-100 text-red-700",
  en_proceso: "bg-amber-100 text-amber-700",
  cerrado: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<MEvent["status"], string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  cerrado: "Cerrado",
};

export default function MantenimientoDetalle() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [event, setEvent] = useState<MEvent | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canOut = usePermission("inventory.out");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    const [ev, it, us] = await Promise.all([
      supabase
        .from("maintenance_events")
        .select(
          "*, pozo:pozo_id(identifier), poi:poi_id(name)"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("inventory_items")
        .select("id, sku, description, unit, price, current_qty")
        .order("sku"),
      supabase
        .from("inventory_usages")
        .select(
          "*, item:item_id(sku, description, unit)"
        )
        .eq("maintenance_event_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setEvent((ev.data as MEvent) || null);
    setItems((it.data as Item[]) || []);
    setUsages((us.data as Usage[]) || []);
    setLoading(false);
  };

  const updateStatus = async (newStatus: MEvent["status"]) => {
    if (!event) return;
    setBusy(true);
    const updates: Record<string, string | null> = { status: newStatus };
    updates.resolved_at =
      newStatus === "cerrado" ? new Date().toISOString() : null;
    await supabase
      .from("maintenance_events")
      .update(updates)
      .eq("id", event.id);
    setBusy(false);
    load();
  };

  const addUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!event) return;
    if (!itemId || !qty || Number(qty) <= 0) {
      setError("Selecciona SKU y cantidad válida.");
      return;
    }
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const qtyNum = Number(qty);
    if (qtyNum > Number(item.current_qty)) {
      setError(
        `Existencia insuficiente (disponible: ${item.current_qty} ${item.unit}).`
      );
      return;
    }
    setBusy(true);
    const unitPrice = Number(item.price);
    const total = unitPrice * qtyNum;

    const ins = await supabase.from("inventory_usages").insert({
      item_id: itemId,
      qty: qtyNum,
      unit_price_snapshot: unitPrice,
      total_cost: total,
      source_type: event.source_type,
      poi_id: event.poi_id,
      pozo_id: event.pozo_id,
      maintenance_event_id: event.id,
      description: description.trim() || null,
    });
    if (ins.error) {
      setBusy(false);
      setError(ins.error.message);
      return;
    }
    await supabase
      .from("inventory_items")
      .update({ current_qty: Number(item.current_qty) - qtyNum })
      .eq("id", itemId);

    setBusy(false);
    setItemId("");
    setQty("");
    setDescription("");
    load();
  };

  const removeUsage = async (u: Usage) => {
    if (!confirm("¿Revertir esta salida de material?")) return;
    setBusy(true);
    const it = items.find((i) => i.id === u.item_id);
    await supabase.from("inventory_usages").delete().eq("id", u.id);
    if (it) {
      await supabase
        .from("inventory_items")
        .update({ current_qty: Number(it.current_qty) + Number(u.qty) })
        .eq("id", u.item_id);
    }
    setBusy(false);
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-dtm-blue"></div>
      </div>
    );
  }
  if (!event) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <p className="text-gray-500">Evento no encontrado.</p>
      </div>
    );
  }

  const sourceHref =
    event.source_type === "pozo" && event.pozo_id
      ? `/pozos/${event.pozo_id}`
      : event.source_type === "poi" && event.poi_id
        ? `/poi/${event.poi_id}`
        : null;
  const sourceLabel =
    event.pozo?.identifier || event.poi?.name || "Sin origen";

  const totalSpent = usages.reduce((a, u) => a + Number(u.total_cost), 0);

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <Link
        href="/mantenimiento"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a Mantenimiento
      </Link>

      <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[event.status]}`}
              >
                {STATUS_LABELS[event.status]}
              </span>
              <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                {event.source_type === "pozo" ? (
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
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-amber-600" />
              {EVENT_LABELS[event.event_type] || event.event_type}
            </h1>
            {event.description && (
              <p className="text-gray-600 mt-2">{event.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Creado:{" "}
              {new Date(event.created_at).toLocaleString("es-MX", {
                timeZone: "America/Mexico_City",
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {event.resolved_at &&
                ` · Resuelto: ${new Date(event.resolved_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" })}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          {event.status === "abierto" && (
            <button
              disabled={busy}
              onClick={() => updateStatus("en_proceso")}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Clock className="w-3 h-3" />
              Tomar
            </button>
          )}
          {event.status !== "cerrado" && (
            <button
              disabled={busy}
              onClick={() => updateStatus("cerrado")}
              className="px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3" />
              Cerrar
            </button>
          )}
          {event.status === "cerrado" && (
            <button
              disabled={busy}
              onClick={() => updateStatus("abierto")}
              className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3" />
              Reabrir
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Box className="w-5 h-5 text-dtm-blue" />
            Material utilizado
          </h2>
          <span className="text-sm text-gray-600">
            Total gastado:{" "}
            <span className="font-bold text-gray-800">
              ${totalSpent.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </span>
        </div>

        {event.status !== "cerrado" && canOut && (
          <form
            onSubmit={addUsage}
            className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2 mb-4"
          >
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 bg-white text-sm"
            >
              <option value="">Selecciona SKU...</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} — {i.description} ({i.current_qty} {i.unit})
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Cantidad"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-1 bg-dtm-blue text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-blue-800 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Asignar
            </button>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Descripción del uso (opcional)..."
              className="md:col-span-3 border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
            {error && (
              <div className="md:col-span-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-2">
                {error}
              </div>
            )}
          </form>
        )}

        {usages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Aún no se ha asignado material a este evento.
          </p>
        ) : (
          <div className="space-y-2">
            {usages.map((u) => (
              <div
                key={u.id}
                className="flex items-start justify-between gap-3 border-t border-gray-100 pt-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {u.item?.sku} · {u.qty} {u.item?.unit}
                    <span className="font-normal text-gray-500 ml-2">
                      = ${Number(u.total_cost).toFixed(2)}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {u.item?.description}
                    {" · "}
                    {new Date(u.created_at).toLocaleString("es-MX", {
                      timeZone: "America/Mexico_City",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  {u.description && (
                    <p className="text-xs text-gray-600 mt-1">
                      {u.description}
                    </p>
                  )}
                </div>
                {event.status !== "cerrado" && canOut && (
                  <button
                    onClick={() => removeUsage(u)}
                    disabled={busy}
                    className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg disabled:opacity-50"
                    title="Revertir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
