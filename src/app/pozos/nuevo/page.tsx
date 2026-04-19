"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Droplet, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/utils/supabase/client";

type Kind = "urbano" | "rural";

export default function NuevoPozo() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [wellNumber, setWellNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [kind, setKind] = useState<Kind>("urbano");
  const [chlorinator, setChlorinator] = useState("");
  const [isOperational, setIsOperational] = useState(true);
  const [notes, setNotes] = useState("");
  const [points, setPoints] = useState<string[]>([""]);

  const updatePoint = (i: number, value: string) => {
    const next = [...points];
    next[i] = value;
    setPoints(next);
  };
  const addPoint = () => setPoints([...points, ""]);
  const removePoint = (i: number) =>
    setPoints(points.length > 1 ? points.filter((_, idx) => idx !== i) : points);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError("");
    if (!wellNumber.trim()) {
      setError("El número de pozo es obligatorio.");
      return;
    }
    const cleanPoints = points.map((p) => p.trim()).filter(Boolean);
    if (cleanPoints.length === 0) {
      setError("Agrega al menos una ubicación de muestreo.");
      return;
    }

    setSaving(true);
    const identifier = nickname.trim()
      ? `${wellNumber.trim()} - ${nickname.trim()}`
      : wellNumber.trim();

    const { data: pozo, error: insertError } = await supabase
      .from("pozos")
      .insert([
        {
          identifier,
          well_number: wellNumber.trim(),
          nickname: nickname.trim() || null,
          kind,
          chlorinator_system: chlorinator.trim() || null,
          is_operational: isOperational,
          notes: notes.trim() || null,
        },
      ])
      .select()
      .single();

    if (insertError || !pozo) {
      setError(insertError?.message || "No se pudo registrar el pozo.");
      setSaving(false);
      return;
    }

    const rows = cleanPoints.map((address, idx) => ({
      pozo_id: pozo.id,
      address,
      position: idx,
    }));
    const { error: pointsError } = await supabase
      .from("pozo_sampling_points")
      .insert(rows);
    if (pointsError) {
      setError(`Pozo creado pero fallaron puntos: ${pointsError.message}`);
      setSaving(false);
      return;
    }

    router.push(`/pozos/${pozo.id}`);
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de pozo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={wellNumber}
                onChange={(e) => setWellNumber(e.target.value)}
                required
                placeholder="Ej. 12"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-dtm-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apodo (opcional)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ej. Norte"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-dtm-blue"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de pozo <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setKind("urbano")}
                className={`px-4 py-3 rounded-xl border-2 font-semibold transition ${
                  kind === "urbano"
                    ? "border-sky-500 bg-sky-50 text-sky-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                🏙️ Urbano (gas-cloro)
              </button>
              <button
                type="button"
                onClick={() => setKind("rural")}
                className={`px-4 py-3 rounded-xl border-2 font-semibold transition ${
                  kind === "rural"
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                🌾 Rural (hipoclorito)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Situación
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsOperational(true)}
                className={`px-4 py-3 rounded-xl border-2 font-semibold transition ${
                  isOperational
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                En operación
              </button>
              <button
                type="button"
                onClick={() => setIsOperational(false)}
                className={`px-4 py-3 rounded-xl border-2 font-semibold transition ${
                  !isOperational
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
              type="text"
              value={chlorinator}
              onChange={(e) => setChlorinator(e.target.value)}
              placeholder="Modelo, tipo, capacidad..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-dtm-blue"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Ubicaciones de muestreo <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addPoint}
                className="inline-flex items-center gap-1 text-xs font-semibold text-dtm-blue hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {points.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={p}
                    onChange={(e) => updatePoint(i, e.target.value)}
                    placeholder={`Dirección de la ubicación #${i + 1}`}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-dtm-blue"
                  />
                  {points.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePoint(i)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Quitar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Cada ubicación es un punto donde se mide cloro residual en la
              revisión diaria.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-dtm-blue resize-none"
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
            className="w-full bg-dtm-blue text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-md disabled:opacity-50"
          >
            {saving ? "Registrando..." : "Registrar Pozo"}
          </button>
        </form>
      </div>
    </div>
  );
}
