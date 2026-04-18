"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import {
  ArrowLeft,
  Box,
  FileText,
  ArrowDown,
  ArrowUp,
  Droplet,
  Activity,
} from "lucide-react";

type Item = {
  id: string;
  sku: string;
  description: string;
  unit: string;
  supplier: string | null;
  supplier_qty: number | null;
  price: number;
  current_qty: number;
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

export default function InventarioDetalle() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [item, setItem] = useState<Item | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [i, e, u] = await Promise.all([
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
      ]);
      setItem((i.data as Item) || null);
      setEntries((e.data as Entry[]) || []);
      setUsages((u.data as Usage[]) || []);
      setLoading(false);
    })();
  }, [id]);

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
          </div>
          <Link
            href="/inventario/entrada"
            className="text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg"
          >
            + Entrada
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Existencia" value={`${item.current_qty} ${item.unit}`} />
          <Metric
            label="Precio unitario"
            value={`$${Number(item.price).toFixed(2)}`}
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
