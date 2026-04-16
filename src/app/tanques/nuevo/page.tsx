"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Cylinder } from "lucide-react";
import { supabase } from "@/utils/supabase/client";

export default function NuevoTanque() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    identifier: "",
    initial_weight_kg: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError("");

    const id = form.identifier.trim();
    const weight = parseFloat(form.initial_weight_kg);
    if (!id || !weight || weight <= 0) return;

    setSaving(true);
    const { data, error: insertError } = await supabase
      .from("tanks")
      .insert([
        {
          identifier: id,
          initial_weight_kg: weight,
          current_weight_kg: weight,
          status: "almacen",
          notes: form.notes.trim() || null,
        },
      ])
      .select()
      .single();

    if (insertError || !data) {
      if (insertError?.code === "23505") {
        setError(`Ya existe un tanque con el identificador "${id}".`);
      } else {
        setError("No se pudo registrar el tanque. Intenta de nuevo.");
      }
      setSaving(false);
      return;
    }

    await supabase.from("tank_events").insert([
      {
        tank_id: data.id,
        event_type: "compra",
        weight_kg: weight,
        notes: form.notes.trim() || null,
      },
    ]);

    router.push(`/tanques/${data.id}`);
  };

  return (
    <div className="w-full max-w-xl mx-auto py-8">
      <Link
        href="/tanques"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a Tanques
      </Link>

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-50 p-3 rounded-xl">
            <Cylinder className="w-6 h-6 text-dtm-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Nuevo Tanque</h1>
            <p className="text-sm text-gray-500">
              Registrar tanque comprado en almacén.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Identificador único
            </label>
            <input
              type="text"
              required
              value={form.identifier}
              onChange={(e) =>
                setForm({ ...form, identifier: e.target.value })
              }
              placeholder="Ej. T-001"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
            />
            <p className="text-xs text-gray-400 mt-1">
              Debe ser único. Se usará para identificar el tanque en todas las
              operaciones.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Peso inicial (lleno)
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                required
                value={form.initial_weight_kg}
                onChange={(e) =>
                  setForm({ ...form, initial_weight_kg: e.target.value })
                }
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                KG
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Proveedor, fecha de compra, etc."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-dtm-blue text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Registrando..." : "Registrar Tanque"}
          </button>
        </form>
      </div>
    </div>
  );
}
