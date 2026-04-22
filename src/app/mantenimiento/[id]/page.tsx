"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { useAuth, usePermission } from "@/context/AuthContext";
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
  UserCheck,
  History,
} from "lucide-react";

type MEvent = {
  id: string;
  source_type: "pozo" | "poi";
  pozo_id: string | null;
  poi_id: string | null;
  event_type: string;
  custom_title: string | null;
  description: string | null;
  resolution_notes: string | null;
  resolution_photos: string[] | null;
  status: "abierto" | "en_proceso" | "cerrado";
  assigned_to: string | null;
  closed_by: string | null;
  created_at: string;
  resolved_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
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

type Technician = { id: string; full_name: string };

type HistoryRow = {
  id: string;
  action: "asignar" | "reasignar" | "cerrar" | "reabrir" | "tomar";
  actor_id: string | null;
  target_id: string | null;
  notes: string | null;
  created_at: string;
  actor?: { full_name: string } | null;
  target?: { full_name: string } | null;
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

const ACTION_LABELS: Record<HistoryRow["action"], string> = {
  asignar: "Asignado",
  reasignar: "Reasignado",
  cerrar: "Cerrado",
  reabrir: "Reabierto",
  tomar: "Tomado",
};

export default function MantenimientoDetalle() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { session, profile } = useAuth();
  const canAssign = usePermission("inventory.out");
  const canManage = !!profile?.permissions.maintenance?.assign;
  const canOut = canAssign;
  const canViewCosts = usePermission("costs.view");

  const [event, setEvent] = useState<MEvent | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [assignedProfile, setAssignedProfile] = useState<Technician | null>(null);
  const [closedByProfile, setClosedByProfile] = useState<Technician | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showAssign, setShowAssign] = useState(false);
  const [selectedTech, setSelectedTech] = useState("");
  const [reopenNotes, setReopenNotes] = useState("");
  const [showReopen, setShowReopen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [closeFiles, setCloseFiles] = useState<File[]>([]);

  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    const [ev, it, us, tk, hs] = await Promise.all([
      supabase
        .from("maintenance_events")
        .select("*, pozo:pozo_id(identifier), poi:poi_id(name)")
        .eq("id", id)
        .single(),
      supabase
        .from("inventory_items")
        .select("id, sku, description, unit, price, current_qty")
        .order("sku"),
      supabase
        .from("inventory_usages")
        .select("*, item:item_id(sku, description, unit)")
        .eq("maintenance_event_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_profiles")
        .select("id, full_name, is_active")
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("maintenance_history")
        .select(
          "*, actor:actor_id(full_name), target:target_id(full_name)"
        )
        .eq("event_id", id)
        .order("created_at", { ascending: false }),
    ]);
    const e = (ev.data as MEvent) || null;
    setEvent(e);
    setItems((it.data as Item[]) || []);
    setUsages((us.data as Usage[]) || []);
    setTechnicians(((tk.data as Technician[]) || []));
    setHistory((hs.data as HistoryRow[]) || []);

    if (e?.assigned_to) {
      const a = (tk.data as Technician[] | null)?.find(
        (t) => t.id === e.assigned_to
      );
      setAssignedProfile(a || null);
    } else setAssignedProfile(null);

    if (e?.closed_by) {
      const c = (tk.data as Technician[] | null)?.find(
        (t) => t.id === e.closed_by
      );
      setClosedByProfile(c || null);
    } else setClosedByProfile(null);

    setLoading(false);
  };

  const logHistory = async (
    action: HistoryRow["action"],
    target_id: string | null,
    notes: string | null
  ) => {
    await supabase.from("maintenance_history").insert({
      event_id: id,
      action,
      actor_id: session?.user.id || null,
      target_id,
      notes,
    });
  };

  const handleAssign = async () => {
    if (!event || !selectedTech || busy) return;
    setBusy(true);
    setActionError(null);
    const isReassign = !!event.assigned_to;
    await supabase
      .from("maintenance_events")
      .update({
        status: "en_proceso",
        assigned_to: selectedTech,
      })
      .eq("id", event.id);
    await logHistory(isReassign ? "reasignar" : "asignar", selectedTech, null);
    setSelectedTech("");
    setShowAssign(false);
    setBusy(false);
    load();
  };

  const handleClose = async () => {
    if (!event || busy) return;
    if (event.assigned_to !== session?.user.id) {
      setActionError("Solo el técnico asignado puede cerrar este evento.");
      return;
    }
    if (!closeNotes.trim()) {
      setActionError("Describe brevemente el trabajo realizado.");
      return;
    }
    if (closeFiles.length === 0) {
      setActionError("Adjunta al menos una foto de evidencia.");
      return;
    }
    setBusy(true);
    setActionError(null);

    const urls: string[] = [];
    for (let idx = 0; idx < closeFiles.length; idx++) {
      const file = closeFiles[idx];
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `maintenance/${event.id}/${Date.now()}-${idx}.${ext}`;
      const up = await supabase.storage
        .from("review-photos")
        .upload(path, file, {
          upsert: false,
          contentType: file.type || "image/jpeg",
        });
      if (up.error) {
        setActionError(`No se pudo subir la foto ${idx + 1}: ${up.error.message}`);
        setBusy(false);
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("review-photos").getPublicUrl(path);
      urls.push(publicUrl);
    }

    await supabase
      .from("maintenance_events")
      .update({
        status: "cerrado",
        closed_by: session.user.id,
        resolved_at: new Date().toISOString(),
        resolution_notes: closeNotes.trim(),
        resolution_photos: urls,
      })
      .eq("id", event.id);
    await logHistory("cerrar", null, closeNotes.trim());
    setCloseNotes("");
    setCloseFiles([]);
    setShowClose(false);
    setBusy(false);
    load();
  };

  const handleReopen = async () => {
    if (!event || busy) return;
    if (event.closed_by && event.closed_by === session?.user.id) {
      setActionError(
        "Quien cerró el evento no puede reabrirlo. Debe hacerlo otro supervisor."
      );
      return;
    }
    setBusy(true);
    setActionError(null);
    await supabase
      .from("maintenance_events")
      .update({
        status: "en_proceso",
        resolved_at: null,
      })
      .eq("id", event.id);
    await logHistory("reabrir", null, reopenNotes.trim() || null);
    setReopenNotes("");
    setShowReopen(false);
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
  const isAssignedToMe = event.assigned_to === session?.user.id;
  const canCloseNow =
    event.status !== "cerrado" && isAssignedToMe;
  const canReopenNow =
    event.status === "cerrado" &&
    canManage &&
    event.closed_by !== session?.user.id;

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
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                  <Link href={sourceHref} className="hover:underline text-dtm-blue">
                    {sourceLabel}
                  </Link>
                ) : (
                  <span>{sourceLabel}</span>
                )}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-amber-600" />
              {event.event_type === "otro" && event.custom_title
                ? event.custom_title
                : EVENT_LABELS[event.event_type] || event.event_type}
            </h1>
            {event.description && (
              <p className="text-gray-600 mt-2">{event.description}</p>
            )}
            <div className="mt-3 space-y-1 text-xs">
              {assignedProfile && (
                <p className="inline-flex items-center gap-1 text-gray-600">
                  <UserCheck className="w-3 h-3 text-dtm-blue" />
                  Asignado a:{" "}
                  <span className="font-semibold text-gray-800">
                    {assignedProfile.full_name}
                  </span>
                </p>
              )}
              {closedByProfile && (
                <p className="text-gray-600">
                  Cerrado por:{" "}
                  <span className="font-semibold text-gray-800">
                    {closedByProfile.full_name}
                  </span>
                </p>
              )}
            </div>
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
            {(event.scheduled_start || event.scheduled_end) && (
              <p className="text-xs text-gray-500 mt-1">
                Programado:{" "}
                {event.scheduled_start
                  ? new Date(event.scheduled_start).toLocaleDateString("es-MX", {
                      timeZone: "America/Mexico_City",
                    })
                  : "—"}
                {" → "}
                {event.scheduled_end
                  ? new Date(event.scheduled_end).toLocaleDateString("es-MX", {
                      timeZone: "America/Mexico_City",
                    })
                  : "—"}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          {canManage && event.status !== "cerrado" && (
            <button
              disabled={busy}
              onClick={() => {
                setShowAssign((v) => !v);
                setShowReopen(false);
                setActionError(null);
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
            >
              <UserCheck className="w-3 h-3" />
              {event.assigned_to ? "Reasignar" : "Asignar"}
            </button>
          )}
          {canCloseNow && (
            <button
              disabled={busy}
              onClick={() => {
                setShowClose((v) => !v);
                setShowAssign(false);
                setShowReopen(false);
                setActionError(null);
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3" />
              Cerrar
            </button>
          )}
          {canReopenNow && (
            <button
              disabled={busy}
              onClick={() => {
                setShowReopen((v) => !v);
                setShowAssign(false);
                setActionError(null);
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3" />
              Reabrir
            </button>
          )}
          {event.status !== "cerrado" &&
            !isAssignedToMe &&
            !canManage &&
            event.assigned_to && (
              <span className="text-xs text-gray-500 inline-flex items-center gap-1 px-2 py-1">
                <Clock className="w-3 h-3" />
                Solo el técnico asignado puede cerrar.
              </span>
            )}
        </div>

        {showAssign && canManage && (
          <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Técnico responsable
            </label>
            <select
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white text-sm"
            >
              <option value="">Selecciona un técnico...</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowAssign(false);
                  setSelectedTech("");
                }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssign}
                disabled={busy || !selectedTech}
                className="flex-1 px-3 py-2 bg-dtm-blue text-white rounded-xl text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                {busy ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        )}

        {showClose && canCloseNow && (
          <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Trabajo realizado <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder="Describe brevemente lo que se hizo..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
            <label className="block text-sm font-medium text-gray-700">
              Evidencia fotográfica <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={(e) =>
                setCloseFiles(Array.from(e.target.files || []))
              }
              className="w-full text-sm"
            />
            {closeFiles.length > 0 && (
              <p className="text-xs text-gray-500">
                {closeFiles.length} archivo(s) seleccionado(s).
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowClose(false);
                  setCloseNotes("");
                  setCloseFiles([]);
                }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleClose}
                disabled={busy}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {busy ? "Cerrando..." : "Confirmar Cierre"}
              </button>
            </div>
          </div>
        )}

        {showReopen && canReopenNow && (
          <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Motivo de la reapertura
            </label>
            <textarea
              rows={2}
              value={reopenNotes}
              onChange={(e) => setReopenNotes(e.target.value)}
              placeholder="Describe por qué se reabre el evento..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowReopen(false);
                  setReopenNotes("");
                }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleReopen}
                disabled={busy}
                className="flex-1 px-3 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
              >
                {busy ? "Guardando..." : "Confirmar Reapertura"}
              </button>
            </div>
          </div>
        )}

        {actionError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg p-2">
            {actionError}
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Box className="w-5 h-5 text-dtm-blue" />
            Material utilizado
          </h2>
          {canViewCosts && (
            <span className="text-sm text-gray-600">
              Total gastado:{" "}
              <span className="font-bold text-gray-800">
                ${totalSpent.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </span>
          )}
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
                    {canViewCosts && (
                      <span className="font-normal text-gray-500 ml-2">
                        = ${Number(u.total_cost).toFixed(2)}
                      </span>
                    )}
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
                    <p className="text-xs text-gray-600 mt-1">{u.description}</p>
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

      {event.status === "cerrado" &&
        (event.resolution_notes ||
          (event.resolution_photos && event.resolution_photos.length > 0)) && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Trabajo realizado
            </h2>
            {event.resolution_notes && (
              <p className="text-sm text-gray-700 whitespace-pre-wrap mb-4">
                {event.resolution_notes}
              </p>
            )}
            {event.resolution_photos && event.resolution_photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {event.resolution_photos.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <img
                      src={url}
                      alt={`Evidencia ${i + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-dtm-blue" />
          Historial del evento
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Sin acciones registradas.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div
                key={h.id}
                className="border-t border-gray-100 pt-3 text-sm first:border-t-0 first:pt-0"
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="font-semibold text-gray-800">
                    {ACTION_LABELS[h.action]}
                    {h.target?.full_name && (
                      <span className="font-normal text-gray-600">
                        {" "}
                        → {h.target.full_name}
                      </span>
                    )}
                  </p>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(h.created_at).toLocaleString("es-MX", {
                      timeZone: "America/Mexico_City",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Por: {h.actor?.full_name || "—"}
                </p>
                {h.notes && (
                  <p className="text-xs text-gray-700 italic mt-1">{h.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
