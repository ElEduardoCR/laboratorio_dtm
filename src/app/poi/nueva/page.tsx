"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NuevaPOI() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    location: "",
    zone: "urbana",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.location.trim()) return;

    setSaving(true);
    const { error } = await supabase.from("poi").insert([
      {
        name: form.name.trim(),
        location: form.location.trim(),
        zone: form.zone,
        is_operational: true,
      },
    ]);

    if (error) {
      console.error("Error al crear POI:", error);
      setSaving(false);
      return;
    }

    router.push("/poi");
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <Link
        href="/poi"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a Plantas
      </Link>

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Registrar Nueva Planta
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nombre */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nombre de la Planta
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="Ej. POI Colinas"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
            />
          </div>

          {/* Ubicación */}
          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Ubicación
            </label>
            <input
              id="location"
              name="location"
              type="text"
              required
              value={form.location}
              onChange={handleChange}
              placeholder="Ej. Col. Las Colinas"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
            />
          </div>

          {/* Zona */}
          <div>
            <label
              htmlFor="zone"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Tipo de Zona
            </label>
            <div className="flex gap-4">
              <label
                className={`flex-1 flex items-center justify-center gap-2 border-2 rounded-xl py-3 px-4 cursor-pointer transition-all font-medium ${
                  form.zone === "urbana"
                    ? "border-dtm-blue bg-blue-50 text-dtm-blue"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="zone"
                  value="urbana"
                  checked={form.zone === "urbana"}
                  onChange={handleChange}
                  className="sr-only"
                />
                🏙️ Urbana
              </label>
              <label
                className={`flex-1 flex items-center justify-center gap-2 border-2 rounded-xl py-3 px-4 cursor-pointer transition-all font-medium ${
                  form.zone === "rural"
                    ? "border-dtm-blue bg-blue-50 text-dtm-blue"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="zone"
                  value="rural"
                  checked={form.zone === "rural"}
                  onChange={handleChange}
                  className="sr-only"
                />
                🌾 Rural
              </label>
            </div>
          </div>

          {/* Botón */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-dtm-blue text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando..." : "Registrar Planta"}
          </button>
        </form>
      </div>
    </div>
  );
}
