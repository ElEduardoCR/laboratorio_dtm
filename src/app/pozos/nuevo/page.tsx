"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Droplet } from "lucide-react";
import { supabase } from "@/utils/supabase/client";

export default function NuevoPozo() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    identifier: "",
    is_operational: true,
    chlorinator_system: "",
    address: "",
    sampling_point: "",
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError("");
    if (!form.identifier.trim()) return;

    setSaving(true);
    const { data, error: insertError } = await supabase
      .from("pozos")
      .insert([
        {
          identifier: form.identifier.trim(),
          is_operational: form.is_operational,
          chlorinator_system: form.chlorinator_system.trim() || null,
          address: form.address.trim() || null,
          sampling_point: form.sampling_point.trim() || null,
          notes: form.notes.trim() || null,
        },
      ])
      .select()
      .single();

    if (insertError || !data) {
      setError("No se pudo registrar el pozo. Intenta de nuevo.");
      setSaving(false);
      return;
    }

    router.push(`/pozos/${data.id}`);
  };

  return (
    <div className="w-full max-w-xl mx-auto py-8">
      <Link
        href="/pozos"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a Pozos
      </Link>

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-50 p-3 rounded-xl">
            <Droplet className="w-6 h-6 text-dtm-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Nuevo Pozo</h1>
            <p className="text-sm text-gray-500">
              Alta de pozo para monitoreo de cloración.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número o nombre del pozo
            </label>
            <input
              name="identifier"
              type="text"
              required
              value={form.identifier}
              onChange={handleChange}
              placeholder="Ej. Pozo 12 Norte"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Situación
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, is_operational: true })}
                className={`px-4 py-3 rounded-xl border-2 font-semibold transition ${
                  form.is_operational
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                En operación
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_operational: false })}
                className={`px-4 py-3 rounded-xl border-2 font-semibold transition ${
                  !form.is_operational
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                Fuera de servicio
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sistema clorador
            </label>
            <input
              name="chlorinator_system"
              type="text"
              value={form.chlorinator_system}
              onChange={handleChange}
              placeholder="Modelo, tipo, capacidad..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección / Ubicación
            </label>
            <textarea
              name="address"
              rows={2}
              value={form.address}
              onChange={handleChange}
              placeholder="Calle, colonia, referencias..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Punto de muestreo
            </label>
            <input
              name="sampling_point"
              type="text"
              value={form.sampling_point}
              onChange={handleChange}
              placeholder="Ej. Salida del tanque, llave de jardín..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
            />
            <p className="text-xs text-gray-400 mt-1">
              Lugar donde se toma la muestra para medir cloro residual.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              name="notes"
              rows={2}
              value={form.notes}
              onChange={handleChange}
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
            {saving ? "Registrando..." : "Registrar Pozo"}
          </button>
        </form>
      </div>
    </div>
  );
}
