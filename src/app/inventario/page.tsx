"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import {
  ArrowLeft,
  Plus,
  Box,
  PackagePlus,
  AlertTriangle,
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

export default function InventarioList() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventory_items")
      .select("*")
      .order("sku", { ascending: true });
    setItems((data as Item[]) || []);
    setLoading(false);
  };

  const filtered = items.filter(
    (i) =>
      !search ||
      i.sku.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = items.reduce(
    (acc, i) => acc + Number(i.price) * Number(i.current_qty),
    0
  );

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      <Link
        href="/"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar al Panel
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Inventario</h1>
          <p className="text-gray-500 mt-1">
            SKUs, entradas de material y asignación a eventos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/inventario/entrada"
            className="inline-flex items-center gap-2 bg-white text-green-700 border-2 border-green-300 px-4 py-2 rounded-xl font-semibold hover:bg-green-50 transition-colors"
          >
            <PackagePlus className="w-4 h-4" />
            Entrada de Material
          </Link>
          <Link
            href="/inventario/nuevo"
            className="inline-flex items-center gap-2 bg-dtm-blue text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo SKU
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500">SKUs registrados</p>
          <p className="text-2xl font-bold text-gray-800">{items.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500">Valor total inventario</p>
          <p className="text-2xl font-bold text-gray-800">
            ${totalValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <input
        type="text"
        placeholder="Buscar por SKU o descripción..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-dtm-blue"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-dtm-blue"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
          <Box className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No hay items en inventario.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-right">Existencia</th>
                <th className="px-4 py-3 text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const low = Number(i.current_qty) <= 0;
                return (
                  <tr
                    key={i.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-dtm-blue">
                      <Link
                        href={`/inventario/${i.id}`}
                        className="hover:underline"
                      >
                        {i.sku}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {i.description}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          low ? "text-red-600" : "text-gray-800"
                        }`}
                      >
                        {low && <AlertTriangle className="w-3 h-3" />}
                        {Number(i.current_qty).toLocaleString("es-MX")} {i.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      ${Number(i.price).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
