"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { ArrowLeft, Save } from "lucide-react";

const UNITS = ["pza", "kg", "g", "L", "mL", "m", "caja", "rollo", "paquete"];

export default function NuevoItem() {
  const router = useRouter();
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("pza");
  const [supplier, setSupplier] = useState("");
  const [supplierQty, setSupplierQty] = useState("");
  const [price, setPrice] = useState("");
  const [isHipoclorito, setIsHipoclorito] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!sku.trim() || !description.trim() || !unit || !price) {
      setError("SKU, descripción, unidad y precio son requeridos.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("inventory_items").insert({
      sku: sku.trim(),
      description: description.trim(),
      unit,
      supplier: supplier.trim() || null,
      supplier_qty: supplierQty ? Number(supplierQty) : null,
      price: Number(price),
      current_qty: 0,
      is_hipoclorito: isHipoclorito,
    });
    setSaving(false);
    if (error) {
      setError(
        error.code === "23505"
          ? "Ese SKU ya existe."
          : error.message || "No se pudo guardar."
      );
      return;
    }
    router.push("/inventario");
  };

  return (
    <div className="w-full max-w-xl mx-auto py-8">
      <Link
        href="/inventario"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a Inventario
      </Link>

      <h1 className="text-3xl font-bold text-gray-800 mb-6">Nuevo SKU</h1>

      <form
        onSubmit={submit}
        className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SKU <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 font-mono uppercase"
            placeholder="FILT-001"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unidad <span className="text-red-500">*</span>
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio unitario <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad por proveedor
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={supplierQty}
              onChange={(e) => setSupplierQty(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2"
              placeholder="p.ej. 10"
            />
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer border border-gray-200 rounded-xl p-3">
          <input
            type="checkbox"
            checked={isHipoclorito}
            onChange={(e) => setIsHipoclorito(e.target.checked)}
            className="mt-1 w-4 h-4 text-dtm-blue rounded"
          />
          <div>
            <p className="text-sm font-semibold text-gray-800">
              Es hipoclorito (rellenos de pozos rurales)
            </p>
            <p className="text-xs text-gray-500">
              Marca este SKU como el inventario que se descuenta al rellenar
              pozos rurales en su revisión diaria.
            </p>
          </div>
        </label>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 bg-dtm-blue text-white font-semibold py-2.5 rounded-xl hover:bg-blue-800 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Guardando..." : "Guardar SKU"}
        </button>
      </form>
    </div>
  );
}
