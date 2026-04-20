"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { useAuth, usePermission } from "@/context/AuthContext";
import {
  ArrowLeft,
  Wrench,
  Plus,
  Trash2,
  Droplet,
  Activity,
  Lock,
} from "lucide-react";

type Pozo = { id: string; identifier: string };
type Poi = { id: string; name: string };
type Item = {
  id: string;
  sku: string;
  description: string;
  unit: string;
  price: number;
  current_qty: number;
};
type Technician = { id: string; full_name: string };

type UsageDraft = {
  key: string;
  item_id: string;
  qty: string;
  description: string;
};

type SourceType = "pozo" | "poi";
type EventType = "cloro_alto" | "cloro_bajo" | "clorador_danado" | "otro";

const EVENT_OPTIONS: { value: EventType; label: string }[] = [
  { value: "clorador_danado", label: "Sistema clorador dañado" },
  { value: "cloro_alto", label: "Cloro residual alto" },
  { value: "cloro_bajo", label: "Cloro residual bajo" },
  { value: "otro", label: "Otro" },
];

export default function NuevoMantenimiento() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const canManage = !!profile?.permissions.maintenance?.assign;
  const canViewCosts = usePermission("costs.view");

  const [pozos, setPozos] = useState<Pozo[]>([]);
  const [pois, setPois] = useState<Poi[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);

  const [sourceType, setSourceType] = useState<SourceType>("pozo");
  const [pozoId, setPozoId] = useState("");
  const [poiId, setPoiId] = useState("");
  const [eventType, setEventType] = useState<EventType>("clorador_danado");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [usages, setUsages] = useState<UsageDraft[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [p, o, i, t] = await Promise.all([
        supabase.from("pozos").select("id, identifier").order("identifier"),
        supabase.from("poi").select("id, name").order("name"),
        supabase
          .from("inventory_items")
          .select("id, sku, description, unit, price, current_qty")
          .order("sku"),
        supabase
          .from("user_profiles")
          .select("id, full_name, is_active")
          .eq("is_active", true)
          .order("full_name"),
      ]);
      setPozos((p.data as Pozo[]) || []);
      setPois((o.data as Poi[]) || []);
      setItems((i.data as Item[]) || []);
      setTechnicians((t.data as Technician[]) || []);
      setLoading(false);
    })();
  }, []);

  const addUsage = () =>
    setUsages((u) => [
      ...u,
      {
        key: `${Date.now()}-${Math.random()}`,
        item_id: "",
        qty: "",
        description: "",
      },
    ]);

  const updateUsage = (key: string, patch: Partial<UsageDraft>) =>
    setUsages((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const removeUsage = (key: string) =>
    setUsages((u) => u.filter((x) => x.key !== key));

  const totalCost = usages.reduce((a, u) => {
    const it = items.find((i) => i.id === u.item_id);
    const q = Number(u.qty) || 0;
    return a + (it ? Number(it.price) * q : 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError("");

    if (sourceType === "pozo" && !pozoId) {
      setError("Selecciona el pozo.");
      return;
    }
    if (sourceType === "poi" && !poiId) {
      setError("Selecciona la planta (POI).");
      return;
    }
    if (!assignedTo) {
      setError("Asigna un técnico responsable.");
      return;
    }
    if (!description.trim()) {
      setError("Describe el trabajo a realizar.");
      return;
    }
    if (!scheduledStart || !scheduledEnd) {
      setError("Indica fecha de inicio y fecha final.");
      return;
    }
    if (scheduledEnd < scheduledStart) {
      setError("La fecha final no puede ser anterior a la fecha de inicio.");
      return;
    }

    const cleanUsages: { item: Item; qty: number; description: string }[] = [];
    for (const u of usages) {
      if (!u.item_id && !u.qty) continue;
      const it = items.find((i) => i.id === u.item_id);
      const q = Number(u.qty);
      if (!it || !q || q <= 0) {
        setError("Cada artículo necesita SKU y cantidad válida.");
        return;
      }
      if (q > Number(it.current_qty)) {
        setError(
          `Existencia insuficiente para ${it.sku} (disponible: ${it.current_qty} ${it.unit}).`
        );
        return;
      }
      cleanUsages.push({ item: it, qty: q, description: u.description.trim() });
    }

    setSaving(true);

    const { data: ev, error: evErr } = await supabase
      .from("maintenance_events")
      .insert({
        source_type: sourceType,
        pozo_id: sourceType === "pozo" ? pozoId : null,
        poi_id: sourceType === "poi" ? poiId : null,
        event_type: eventType,
        description: description.trim(),
        status: "en_proceso",
        assigned_to: assignedTo,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
      })
      .select()
      .single();

    if (evErr || !ev) {
      setError(evErr?.message || "No se pudo crear el evento.");
      setSaving(false);
      return;
    }

    await supabase.from("maintenance_history").insert({
      event_id: ev.id,
      action: "asignar",
      actor_id: session?.user.id || null,
      target_id: assignedTo,
      notes: null,
    });

    for (const u of cleanUsages) {
      const unitPrice = Number(u.item.price);
      await supabase.from("inventory_usages").insert({
        item_id: u.item.id,
        qty: u.qty,
        unit_price_snapshot: unitPrice,
        total_cost: unitPrice * u.qty,
        source_type: sourceType,
        pozo_id: sourceType === "pozo" ? pozoId : null,
        poi_id: sourceType === "poi" ? poiId : null,
        maintenance_event_id: ev.id,
        description: u.description || null,
      });
      await supabase
        .from("inventory_items")
        .update({ current_qty: Number(u.item.current_qty) - u.qty })
        .eq("id", u.item.id);
    }

    router.push(`/mantenimiento/${ev.id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-dtm-blue"></div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <Link
          href="/mantenimiento"
          className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Regresar a Mantenimiento
        </Link>
        <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
          <Lock className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-600 font-semibold">Acceso restringido</p>
          <p className="text-sm text-gray-500 mt-1">
            Solo los administradores pueden crear eventos de mantenimiento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <Link
        href="/mantenimiento"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a Mantenimiento
      </Link>

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-amber-50 p-3 rounded-xl">
            <Wrench className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Nuevo Evento</h1>
            <p className="text-sm text-gray-500">
              Programa un trabajo de mantenimiento y asigna al técnico.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Origen <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSourceType("pozo")}
                className={`px-4 py-3 rounded-xl border-2 font-semibold transition inline-flex items-center justify-center gap-2 ${
                  sourceType === "pozo"
                    ? "border-sky-500 bg-sky-50 text-sky-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <Droplet className="w-4 h-4" /> Pozo
              </button>
              <button
                type="button"
                onClick={() => setSourceType("poi")}
                className={`px-4 py-3 rounded-xl border-2 font-semibold transition inline-flex items-center justify-center gap-2 ${
                  sourceType === "poi"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <Activity className="w-4 h-4" /> Planta (POI)
              </button>
            </div>
          </div>

          {sourceType === "pozo" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pozo <span className="text-red-500">*</span>
              </label>
              <select
                value={pozoId}
                onChange={(e) => setPozoId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white"
              >
                <option value="">Selecciona un pozo...</option>
                {pozos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.identifier}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Planta (POI) <span className="text-red-500">*</span>
              </label>
              <select
                value={poiId}
                onChange={(e) => setPoiId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white"
              >
                <option value="">Selecciona una planta...</option>
                {pois.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de trabajo <span className="text-red-500">*</span>
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white"
            >
              {EVENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción del trabajo <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qué se tiene que hacer, detalles relevantes..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Técnico responsable <span className="text-red-500">*</span>
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white"
            >
              <option value="">Selecciona un técnico...</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Solo el técnico asignado podrá cerrar este evento.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de inicio <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha final <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Artículos de inventario a utilizar
              </label>
              <button
                type="button"
                onClick={addUsage}
                className="inline-flex items-center gap-1 text-xs font-semibold text-dtm-blue hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar artículo
              </button>
            </div>
            {usages.length === 0 && (
              <p className="text-xs text-gray-400">
                Opcional. Puedes agregar material ahora o después desde el detalle del evento.
              </p>
            )}
            <div className="space-y-3">
              {usages.map((u) => {
                const it = items.find((i) => i.id === u.item_id);
                const q = Number(u.qty) || 0;
                const lineCost = it ? Number(it.price) * q : 0;
                return (
                  <div
                    key={u.key}
                    className="border border-gray-200 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex gap-2">
                      <select
                        value={u.item_id}
                        onChange={(e) =>
                          updateUsage(u.key, { item_id: e.target.value })
                        }
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm"
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
                        value={u.qty}
                        onChange={(e) =>
                          updateUsage(u.key, { qty: e.target.value })
                        }
                        placeholder="Cantidad"
                        className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeUsage(u.key)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Quitar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={u.description}
                      onChange={(e) =>
                        updateUsage(u.key, { description: e.target.value })
                      }
                      placeholder="Nota de uso (opcional)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                    {canViewCosts && it && q > 0 && (
                      <p className="text-xs text-gray-500">
                        Subtotal:{" "}
                        <span className="font-semibold text-gray-800">
                          ${lineCost.toFixed(2)}
                        </span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {canViewCosts && usages.length > 0 && (
              <p className="text-sm text-right mt-2">
                Total estimado:{" "}
                <span className="font-bold text-gray-800">
                  ${totalCost.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-dtm-blue text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-md disabled:opacity-50"
          >
            {saving ? "Creando..." : "Crear evento"}
          </button>
        </form>
      </div>
    </div>
  );
}
