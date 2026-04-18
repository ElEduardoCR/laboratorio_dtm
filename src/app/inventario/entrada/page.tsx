"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { ArrowLeft, Save, FileUp } from "lucide-react";

type Item = {
  id: string;
  sku: string;
  description: string;
  unit: string;
  current_qty: number;
  price: number;
};

export default function EntradaMaterial() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [poFile, setPoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select("id, sku, description, unit, current_qty, price")
        .order("sku", { ascending: true });
      setItems((data as Item[]) || []);
      setLoading(false);
    })();
  }, []);

  const selected = items.find((i) => i.id === itemId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!itemId || !qty || Number(qty) <= 0) {
      setError("Selecciona el SKU y una cantidad válida.");
      return;
    }
    if (!poFile) {
      setError("Adjunta la orden de compra.");
      return;
    }
    setSaving(true);

    const ext = poFile.name.split(".").pop() || "pdf";
    const path = `inventory/po/${itemId}/${Date.now()}.${ext}`;
    const up = await supabase.storage
      .from("review-photos")
      .upload(path, poFile);
    if (up.error) {
      setSaving(false);
      setError("No se pudo subir la orden de compra.");
      return;
    }
    const { data: pub } = supabase.storage
      .from("review-photos")
      .getPublicUrl(path);

    const qtyNum = Number(qty);
    const priceNum = unitPrice ? Number(unitPrice) : null;

    const entry = await supabase.from("inventory_entries").insert({
      item_id: itemId,
      qty: qtyNum,
      unit_price: priceNum,
      purchase_order_url: pub.publicUrl,
      notes: notes.trim() || null,
    });
    if (entry.error) {
      setSaving(false);
      setError(entry.error.message);
      return;
    }

    const updates: Record<string, number> = {
      current_qty: Number(selected!.current_qty) + qtyNum,
    };
    if (priceNum !== null) updates.price = priceNum;
    await supabase.from("inventory_items").update(updates).eq("id", itemId);

    setSaving(false);
    router.push(`/inventario/${itemId}`);
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

      <h1 className="text-3xl font-bold text-gray-800 mb-1">
        Entrada de Material
      </h1>
      <p className="text-gray-500 mb-6">
        Registra el ingreso de material y suma al inventario existente.
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-dtm-blue"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
          <p className="text-gray-500 mb-3">
            No hay SKUs registrados. Da de alta uno primero.
          </p>
          <Link
            href="/inventario/nuevo"
            className="inline-flex items-center gap-2 bg-dtm-blue text-white px-4 py-2 rounded-xl font-semibold"
          >
            Nuevo SKU
          </Link>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU <span className="text-red-500">*</span>
            </label>
            <select
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                const found = items.find((i) => i.id === e.target.value);
                if (found) setUnitPrice(String(found.price));
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white"
              required
            >
              <option value="">Selecciona un SKU...</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} — {i.description}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-900">
              Existencia actual:{" "}
              <span className="font-semibold">
                {Number(selected.current_qty).toLocaleString("es-MX")}{" "}
                {selected.unit}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad a ingresar <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio unitario (esta compra)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orden de compra (PDF/imagen){" "}
              <span className="text-red-500">*</span>
            </label>
            <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl px-3 py-3 cursor-pointer hover:bg-gray-50">
              <FileUp className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 flex-1">
                {poFile ? poFile.name : "Adjuntar orden de compra..."}
              </span>
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setPoFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2"
              placeholder="No. de factura, observaciones..."
            />
          </div>

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
            {saving ? "Registrando..." : "Registrar entrada"}
          </button>
        </form>
      )}
    </div>
  );
}
