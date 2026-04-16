"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  PackageCheck,
  Upload,
  X,
  FileText,
  CheckSquare,
  Square,
} from "lucide-react";
import { supabase } from "@/utils/supabase/client";

type Tank = {
  id: string;
  identifier: string;
  current_weight_kg: number;
  initial_weight_kg: number;
};

export default function RecibirProveedor() {
  const router = useRouter();
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tanks")
      .select("id, identifier, current_weight_kg, initial_weight_kg")
      .eq("status", "en_proveedor")
      .order("identifier");
    setTanks((data as Tank[]) || []);
    setLoading(false);
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === tanks.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tanks.map((t) => t.id)));
    }
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (selected.size === 0) {
      setError("Selecciona al menos un tanque.");
      return;
    }
    if (!evidenceFile) {
      setError("Adjunta el documento de evidencia.");
      return;
    }
    setSaving(true);
    setError("");

    const ext = evidenceFile.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `tanks/refills/refill-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("review-photos")
      .upload(path, evidenceFile, {
        upsert: true,
        contentType: evidenceFile.type || "application/octet-stream",
      });
    if (upErr) {
      setError("No se pudo subir el documento.");
      setSaving(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("review-photos").getPublicUrl(path);

    const selectedTanks = tanks.filter((t) => selected.has(t.id));

    // Update each tank: status -> almacen, current_weight -> initial_weight
    for (const t of selectedTanks) {
      await supabase
        .from("tanks")
        .update({
          status: "almacen",
          current_weight_kg: t.initial_weight_kg,
        })
        .eq("id", t.id);
    }

    await supabase.from("tank_events").insert(
      selectedTanks.map((t) => ({
        tank_id: t.id,
        event_type: "recibido_proveedor",
        weight_kg: t.initial_weight_kg,
        document_url: publicUrl,
        notes: notes.trim() || null,
      }))
    );

    setSaving(false);
    router.push("/tanques");
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-8">
      <Link
        href="/tanques"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a Tanques
      </Link>

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-green-50 p-3 rounded-xl">
            <PackageCheck className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Recibir Tanques del Proveedor
            </h1>
            <p className="text-sm text-gray-500">
              GSG Supplies S. de R.L. de C.V. — los tanques regresan rellenados
              a su peso inicial.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dtm-blue"></div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Selecciona los tanques que se recibieron rellenados
                </h2>
                {tanks.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-dtm-blue hover:underline font-medium"
                  >
                    {selected.size === tanks.length
                      ? "Deseleccionar todos"
                      : "Seleccionar todos"}
                  </button>
                )}
              </div>
              {tanks.length === 0 ? (
                <p className="text-sm text-gray-400 bg-gray-50 p-4 rounded-lg text-center">
                  No hay tanques en el proveedor en este momento.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {tanks.map((t) => {
                    const checked = selected.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggle(t.id)}
                        className={`flex items-center gap-3 p-3 border-2 rounded-xl text-left transition ${
                          checked
                            ? "border-green-500 bg-green-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="w-5 h-5 text-green-600 shrink-0" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm">
                            {t.identifier}
                          </p>
                          <p className="text-xs text-gray-500">
                            Volverá a {t.initial_weight_kg} KG (lleno)
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Documento de evidencia
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Remisión, factura o ticket entregado por el proveedor.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                id="evidence-file"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setEvidenceFile(f);
                  if (f && f.type.startsWith("image/")) {
                    setEvidencePreview(URL.createObjectURL(f));
                  } else {
                    setEvidencePreview("");
                  }
                }}
              />
              {evidenceFile ? (
                <div className="border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                  {evidencePreview ? (
                    <img
                      src={evidencePreview}
                      alt=""
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <FileText className="w-10 h-10 text-gray-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {evidenceFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(evidenceFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEvidenceFile(null);
                      setEvidencePreview("");
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="text-red-500 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="evidence-file"
                  className="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 text-sm text-gray-500"
                >
                  <Upload className="w-4 h-4" />
                  Adjuntar evidencia (PDF o imagen)
                </label>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notas (opcional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Folio de remisión, observaciones del proveedor..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Link
                href="/tanques"
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 text-center"
              >
                Cancelar
              </Link>
              <button
                onClick={handleSubmit}
                disabled={
                  saving ||
                  selected.size === 0 ||
                  !evidenceFile ||
                  tanks.length === 0
                }
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? "Recibiendo..."
                  : `Recibir ${selected.size || ""} ${selected.size === 1 ? "tanque" : "tanques"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
