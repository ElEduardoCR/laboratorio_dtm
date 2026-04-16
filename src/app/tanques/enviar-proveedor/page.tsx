"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Truck,
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

export default function EnviarProveedor() {
  const router = useRouter();
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [poFile, setPoFile] = useState<File | null>(null);
  const [poPreview, setPoPreview] = useState("");
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
      .eq("status", "almacen")
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

  const handleSubmit = async () => {
    if (saving) return;
    if (selected.size === 0) {
      setError("Selecciona al menos un tanque.");
      return;
    }
    if (!poFile) {
      setError("Adjunta la orden de compra.");
      return;
    }
    setSaving(true);
    setError("");

    const ext = poFile.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `tanks/orders/oc-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("review-photos")
      .upload(path, poFile, {
        upsert: true,
        contentType: poFile.type || "application/octet-stream",
      });
    if (upErr) {
      setError("No se pudo subir la orden de compra.");
      setSaving(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("review-photos").getPublicUrl(path);

    const ids = Array.from(selected);

    await supabase
      .from("tanks")
      .update({ status: "en_proveedor", current_poi_id: null })
      .in("id", ids);

    await supabase.from("tank_events").insert(
      ids.map((tid) => ({
        tank_id: tid,
        event_type: "enviado_proveedor",
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
          <div className="bg-amber-50 p-3 rounded-xl">
            <Truck className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Enviar Tanques a Proveedor
            </h1>
            <p className="text-sm text-gray-500">
              GSG Supplies S. de R.L. de C.V.
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
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Selecciona los tanques que se enviarán a rellenar
              </h2>
              {tanks.length === 0 ? (
                <p className="text-sm text-gray-400 bg-gray-50 p-4 rounded-lg text-center">
                  No hay tanques disponibles en almacén.
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
                            ? "border-amber-500 bg-amber-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="w-5 h-5 text-amber-600 shrink-0" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm">
                            {t.identifier}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t.current_weight_kg} / {t.initial_weight_kg} KG
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
                Orden de compra
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                id="po-file"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setPoFile(f);
                  if (f && f.type.startsWith("image/")) {
                    setPoPreview(URL.createObjectURL(f));
                  } else {
                    setPoPreview("");
                  }
                }}
              />
              {poFile ? (
                <div className="border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                  {poPreview ? (
                    <img
                      src={poPreview}
                      alt=""
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <FileText className="w-10 h-10 text-gray-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {poFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(poFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPoFile(null);
                      setPoPreview("");
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="text-red-500 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="po-file"
                  className="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-amber-500 hover:bg-amber-50 text-sm text-gray-500"
                >
                  <Upload className="w-4 h-4" />
                  Adjuntar orden de compra (PDF o imagen)
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
                placeholder="Folio de OC, fecha de entrega esperada..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
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
                  saving || selected.size === 0 || !poFile || tanks.length === 0
                }
                className="flex-1 bg-amber-600 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? "Enviando..."
                  : `Enviar ${selected.size || ""} ${selected.size === 1 ? "tanque" : "tanques"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
