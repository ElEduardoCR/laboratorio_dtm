"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { useAuth, usePermission } from "@/context/AuthContext";
import {
  ArrowLeft,
  Box,
  FileText,
  ArrowDown,
  ArrowUp,
  Droplet,
  Activity,
  Pencil,
  History,
} from "lucide-react";

type Item = {
  id: string;
  sku: string;
  description: string;
  unit: string;
  supplier: string | null;
  supplier_qty: number | null;
  pack_size: number | null;
  pack_unit: string | null;
  price: number | null;
  current_qty: number | null;
};

type Entry = {
  id: string;
  qty: number;
  unit_price: number | null;
  purchase_order_url: string | null;
  notes: string | null;
  created_at: string;
};

type Usage = {
  id: string;
  qty: number;
  unit_price_snapshot: number;
  total_cost: number;
  source_type: "poi" | "pozo" | null;
  poi_id: string | null;
  pozo_id: string | null;
  description: string | null;
  created_at: string;
  poi?: { name: string } | null;
  pozo?: { identifier: string } | null;
};

type AdjChange = { field: string; old: unknown; new: unknown };
type Adjustment = {
  id: string;
  reason: string;
  changes: AdjChange[];
  actor_id: string | null;
  created_at: string;
  actor?: { full_name: string } | null;
};

const FIELD_LABELS: Record<string, string> = {
  sku: "SKU",
  description: "Descripción",
  unit: "Unidad",
  supplier: "Proveedor",
  supplier_qty: "Cantidad por pedido",
  pack_size: "Contenido por paquete",
  pack_unit: "Unidad del contenido",
  price: "Precio unitario",
  current_qty: "Existencia",
};

export default function InventarioDetalle() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { session } = useAuth();
  const canAdjust = usePermission("inventory.in");

  const [item, setItem] = useState<Item | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    sku: "",
    description: "",
    unit: "",
    supplier: "",
    supplier_qty: "",
    pack_size: "",
    pack_unit: "",
    price: "",
    current_qty: "",
    reason: "",
  });

  const load = async () => {
    if (!id) return;
    const [i, e, u, a] = await Promise.all([
      supabase.from("inventory_items").select("*").eq("id", id).single(),
      supabase
        .from("inventory_entries")
        .select("*")
        .eq("item_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("inventory_usages")
        .select("*, poi:poi_id(name), pozo:pozo_id(identifier)")
        .eq("item_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("inventory_adjustments")
        .select("*")
        .eq("item_id", id)
        .order("created_at", { ascending: false }),
    ]);
    const it = (i.data as Item) || null;
    setItem(it);
    setEntries((e.data as Entry[]) || []);
    setUsages((u.data as Usage[]) || []);

    const adjs = (a.data as Adjustment[]) || [];
    const actorIds = Array.from(
      new Set(adjs.map((x) => x.actor_id).filter(Boolean))
    ) as string[];
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", actorIds);
      const byId = new Map(
        ((profs as { id: string; full_name: string }[]) || []).map((p) => [
          p.id,
          p.full_name,
        ])
      );
      adjs.forEach((adj) => {
        if (adj.actor_id) {
          const name = byId.get(adj.actor_id);
          adj.actor = name ? { full_name: name } : null;
        }
      });
    }
    setAdjustments(adjs);

    if (it) {
      setForm({
        sku: it.sku,
        description: it.description,
        unit: it.unit,
        supplier: it.supplier || "",
        supplier_qty: it.supplier_qty?.toString() || "",
        pack_size: it.pack_size?.toString() || "",
        pack_unit: it.pack_unit || "",
        price: it.price === null || it.price === undefined ? "" : it.price.toString(),
        current_qty: it.current_qty === null || it.current_qty === undefined ? "" : it.current_qty.toString(),
        reason: "",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || busy) return;
    setFormError("");

    if (!form.sku.trim() || !form.description.trim()) {
      setFormError("SKU y descripción son obligatorios.");
      return;
    }
    if (!form.reason.trim()) {
      setFormError("Indica el motivo del ajuste.");
      return;
    }
    const priceNum = form.price.trim() ? parseFloat(form.price) : null;
    const qtyNum = form.current_qty.trim() ? parseFloat(form.current_qty) : 0;
    const supQtyNum = form.supplier_qty
      ? parseFloat(form.supplier_qty)
      : null;
    const packSizeNum = form.pack_size ? parseFloat(form.pack_size) : null;
    if (priceNum !== null && (isNaN(priceNum) || priceNum < 0)) {
      setFormError("Precio inválido.");
      return;
    }
    if (isNaN(qtyNum) || qtyNum < 0) {
      setFormError("Existencia inválida.");
      return;
    }

    const next = {
      sku: form.sku.trim(),
      description: form.description.trim(),
      unit: form.unit.trim() || null,
      supplier: form.supplier.trim() || null,
      supplier_qty: supQtyNum,
      pack_size: packSizeNum,
      pack_unit: form.pack_unit.trim() || null,
      price: priceNum,
      current_qty: qtyNum,
    };
    const prev = {
      sku: item.sku,
      description: item.description,
      unit: item.unit,
      supplier: item.supplier,
      supplier_qty: item.supplier_qty,
      pack_size: item.pack_size,
      pack_unit: item.pack_unit,
      price: item.price === null || item.price === undefined ? null : Number(item.price),
      current_qty: Number(item.current_qty || 0),
    };

    const changes: AdjChange[] = [];
    (Object.keys(next) as (keyof typeof next)[]).forEach((k) => {
      const a = prev[k];
      const b = next[k];
      const aN = a === null || a === undefined ? null : a;
      const bN = b === null || b === undefined ? null : b;
      if (aN !== bN) changes.push({ field: k, old: aN, new: bN });
    });

    if (changes.length === 0) {
      setFormError("No hay cambios que guardar.");
      return;
    }

    setBusy(true);
    const { error: upErr } = await supabase
      .from("inventory_items")
      .update({ ...next, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (upErr) {
      setFormError(upErr.message);
      setBusy(false);
      return;
    }
    await supabase.from("inventory_adjustments").insert({
      item_id: item.id,
      actor_id: session?.user.id || null,
      reason: form.reason.trim(),
      changes,
    });
    setShowEdit(false);
    setBusy(false);
    load();
  };

  const formatVal = (field: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (field === "price") return `$${Number(v).toFixed(2)}`;
    if (
      field === "current_qty" ||
      field === "supplier_qty" ||
      field === "pack_size"
    ) {
      return `${v}`;
    }
    return String(v);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-dtm-blue"></div>
      </div>
    );
  }
  if (!item) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <p className="text-gray-500">Item no encontrado.</p>
      </div>
    );
  }

  const totalIn = entries.reduce((a, e) => a + Number(e.qty), 0);
  const totalOut = usages.reduce((a, u) => a + Number(u.qty), 0);
  const totalSpent = usages.reduce((a, u) => a + Number(u.total_cost), 0);

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      <Link
        href="/inventario"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a Inventario
      </Link>

      <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Box className="w-5 h-5 text-dtm-blue" />
              <span className="font-mono font-bold text-dtm-blue">
                {item.sku}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              {item.description}
            </h1>
            {item.supplier && (
              <p className="text-sm text-gray-500 mt-1">
                Proveedor: {item.supplier}
                {item.supplier_qty
                  ? ` (${item.supplier_qty} ${item.unit} por pedido)`
                  : ""}
              </p>
            )}
            {item.pack_size && (
              <p className="text-sm text-gray-500">
                Contenido por paquete: {item.pack_size}
                {item.pack_unit ? ` ${item.pack_unit}` : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canAdjust && (
              <button
                type="button"
                onClick={() => {
                  setShowEdit((v) => !v);
                  setFormError("");
                }}
                className="text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                {showEdit ? "Cancelar" : "Editar / Ajustar"}
              </button>
            )}
            <Link
              href="/inventario/entrada"
              className="text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg"
            >
              + Entrada
            </Link>
          </div>
        </div>

        {showEdit && canAdjust && (
          <form
            onSubmit={handleSubmit}
            className="mt-4 border-t border-gray-100 pt-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  SKU
                </label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Unidad
                </label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="kg, l, pz..."
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Proveedor
                </label>
                <input
                  type="text"
                  value={form.supplier}
                  onChange={(e) =>
                    setForm({ ...form, supplier: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Cantidad por pedido
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={form.supplier_qty}
                  onChange={(e) =>
                    setForm({ ...form, supplier_qty: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Contenido por paquete
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={form.pack_size}
                  onChange={(e) =>
                    setForm({ ...form, pack_size: e.target.value })
                  }
                  placeholder="p.ej. 10"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Unidad del contenido
                </label>
                <input
                  type="text"
                  value={form.pack_unit}
                  onChange={(e) =>
                    setForm({ ...form, pack_unit: e.target.value })
                  }
                  placeholder="kg, pza..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Precio unitario ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Existencia ({item.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={form.current_qty}
                  onChange={(e) =>
                    setForm({ ...form, current_qty: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Motivo del ajuste <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Ej. Conteo físico, corrección de captura, merma..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {formError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 px-3 py-2 bg-dtm-blue text-white rounded-xl text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                {busy ? "Guardando..." : "Guardar ajuste"}
              </button>
            </div>
          </form>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric
            label="Existencia"
            value={`${item.current_qty ?? 0} ${item.unit || ""}`.trim()}
          />
          <Metric
            label="Precio unitario"
            value={
              item.price === null || item.price === undefined
                ? "—"
                : `$${Number(item.price).toFixed(2)}`
            }
          />
          <Metric label="Entradas" value={`${totalIn} ${item.unit}`} />
          <Metric
            label="Gasto acumulado"
            value={`$${totalSpent.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
          />
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <ArrowDown className="w-4 h-4 text-green-600" />
        Entradas ({entries.length})
      </h2>
      {entries.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center text-sm text-gray-400 mb-6">
          Sin entradas registradas.
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {entries.map((e) => (
            <div
              key={e.id}
              className="bg-white rounded-xl p-4 border border-gray-100 flex items-center justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-semibold text-gray-800">
                  +{e.qty} {item.unit}
                  {e.unit_price !== null && (
                    <span className="font-normal text-gray-500 ml-2">
                      @ ${Number(e.unit_price).toFixed(2)}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(e.created_at).toLocaleString("es-MX", {
                    timeZone: "America/Mexico_City",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                {e.notes && (
                  <p className="text-xs text-gray-600 mt-1">{e.notes}</p>
                )}
              </div>
              {e.purchase_order_url && (
                <a
                  href={e.purchase_order_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-dtm-blue hover:underline"
                >
                  <FileText className="w-3 h-3" />
                  OC
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <ArrowUp className="w-4 h-4 text-red-600" />
        Salidas / Uso ({usages.length}) — {totalOut} {item.unit}
      </h2>
      {usages.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center text-sm text-gray-400">
          Sin salidas registradas.
        </div>
      ) : (
        <div className="space-y-2">
          {usages.map((u) => {
            const href =
              u.source_type === "poi" && u.poi_id
                ? `/poi/${u.poi_id}`
                : u.source_type === "pozo" && u.pozo_id
                  ? `/pozos/${u.pozo_id}`
                  : null;
            const label =
              u.poi?.name || u.pozo?.identifier || "Sin destino";
            return (
              <div
                key={u.id}
                className="bg-white rounded-xl p-4 border border-gray-100 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">
                      -{u.qty} {item.unit}
                      <span className="font-normal text-gray-500 ml-2">
                        = ${Number(u.total_cost).toFixed(2)}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 inline-flex items-center gap-1 mt-1">
                      {u.source_type === "poi" ? (
                        <Activity className="w-3 h-3" />
                      ) : (
                        <Droplet className="w-3 h-3" />
                      )}
                      {href ? (
                        <Link
                          href={href}
                          className="hover:underline text-dtm-blue"
                        >
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                      {" · "}
                      {new Date(u.created_at).toLocaleString("es-MX", {
                        timeZone: "America/Mexico_City",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </div>
                {u.description && (
                  <p className="text-xs text-gray-600 mt-2">{u.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-800 mt-8 mb-3 flex items-center gap-2">
        <History className="w-4 h-4 text-amber-600" />
        Ajustes ({adjustments.length})
      </h2>
      {adjustments.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center text-sm text-gray-400">
          Sin ajustes registrados.
        </div>
      ) : (
        <div className="space-y-2">
          {adjustments.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-xl p-4 border border-gray-100 text-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-xs text-gray-500">
                  {new Date(a.created_at).toLocaleString("es-MX", {
                    timeZone: "America/Mexico_City",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {a.actor?.full_name && (
                    <span className="ml-2 text-gray-700">
                      · {a.actor.full_name}
                    </span>
                  )}
                </p>
              </div>
              <p className="text-sm text-gray-700 italic mb-2">{a.reason}</p>
              <div className="space-y-1">
                {(a.changes || []).map((c, idx) => (
                  <p
                    key={idx}
                    className="text-xs text-gray-600 font-mono break-words"
                  >
                    <span className="font-semibold text-gray-800">
                      {FIELD_LABELS[c.field] || c.field}:
                    </span>{" "}
                    <span className="text-red-600 line-through">
                      {formatVal(c.field, c.old)}
                    </span>{" "}
                    →{" "}
                    <span className="text-green-700">
                      {formatVal(c.field, c.new)}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
    </div>
  );
}
