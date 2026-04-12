"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

// Get today's date string in Mexico City timezone
function getTodayMexicoCity(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  }); // Returns YYYY-MM-DD
}

export default function RevisionDiaria() {
  const params = useParams();
  const router = useRouter();
  const poiId = params?.id as string;

  const [poiName, setPoiName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const [form, setForm] = useState({
    chlorine_residual: "",
    cylinder_weight: "",
    observations: "",
  });

  useEffect(() => {
    if (poiId) {
      loadData();
    }
  }, [poiId]);

  const loadData = async () => {
    setLoading(true);

    // Get POI name
    const { data: poi } = await supabase
      .from("poi")
      .select("name")
      .eq("id", poiId)
      .single();

    if (poi) setPoiName(poi.name);

    // Check if today's review already exists
    const todayStr = getTodayMexicoCity();
    const { data: existing } = await supabase
      .from("daily_reviews")
      .select("id")
      .eq("poi_id", poiId)
      .eq("review_date", todayStr)
      .maybeSingle();

    if (existing) {
      setAlreadySubmitted(true);
    }

    setLoading(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (alreadySubmitted || saving) return;
    if (!form.chlorine_residual || !form.cylinder_weight) return;

    setSaving(true);
    const todayStr = getTodayMexicoCity();

    const { error } = await supabase.from("daily_reviews").insert([
      {
        poi_id: poiId,
        chlorine_residual: parseFloat(form.chlorine_residual),
        cylinder_weight: parseFloat(form.cylinder_weight),
        observations: form.observations.trim() || null,
        review_date: todayStr,
      },
    ]);

    if (error) {
      console.error("Error al guardar revisión:", error);
      // If unique constraint violation, it means already submitted
      if (error.code === "23505") {
        setAlreadySubmitted(true);
      }
      setSaving(false);
      return;
    }

    // Also update the POI's chlorine_input with the latest reading
    await supabase
      .from("poi")
      .update({ chlorine_input: parseFloat(form.chlorine_residual) })
      .eq("id", poiId);

    setAlreadySubmitted(true);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dtm-blue"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <Link
        href={`/poi/${poiId}`}
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a {poiName}
      </Link>

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">
          Revisión Diaria
        </h1>
        <p className="text-gray-500 mb-6">
          {poiName} —{" "}
          {new Date().toLocaleDateString("es-MX", {
            timeZone: "America/Mexico_City",
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        {alreadySubmitted ? (
          <div className="text-center py-10">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Revisión Registrada
            </h2>
            <p className="text-gray-500 max-w-sm mx-auto">
              Ya se registró la revisión diaria de hoy. El siguiente registro
              estará disponible mañana a las 00:01 hrs (hora CDMX).
            </p>
            <Link
              href={`/poi/${poiId}`}
              className="inline-block mt-6 bg-dtm-blue text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors"
            >
              Volver a la Planta
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cloro Residual */}
            <div>
              <label
                htmlFor="chlorine_residual"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Cloro Residual
              </label>
              <div className="relative">
                <input
                  id="chlorine_residual"
                  name="chlorine_residual"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  required
                  value={form.chlorine_residual}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-16 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                  mg/L
                </span>
              </div>
            </div>

            {/* Peso del Cilindro */}
            <div>
              <label
                htmlFor="cylinder_weight"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Peso Actual del Cilindro Cloro-Gas
              </label>
              <div className="relative">
                <input
                  id="cylinder_weight"
                  name="cylinder_weight"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  required
                  value={form.cylinder_weight}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                  KG
                </span>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label
                htmlFor="observations"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Observaciones
              </label>
              <textarea
                id="observations"
                name="observations"
                rows={3}
                value={form.observations}
                onChange={handleChange}
                placeholder="Notas adicionales sobre la revisión..."
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition resize-none"
              />
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-dtm-blue text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Registrando..." : "Finalizar Registro"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
