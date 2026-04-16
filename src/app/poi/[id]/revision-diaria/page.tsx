"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { ArrowLeft, CheckCircle2, Camera, X } from "lucide-react";
import Link from "next/link";

function getTodayMexicoCity(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });
}

type PhotoField =
  | "photo_chlorine_input"
  | "photo_chlorine_output"
  | "photo_hardness_input"
  | "photo_hardness_output";

const PHOTO_FIELDS: { key: PhotoField; label: string }[] = [
  { key: "photo_chlorine_input", label: "Foto Cloro Entrada" },
  { key: "photo_chlorine_output", label: "Foto Cloro Salida" },
  { key: "photo_hardness_input", label: "Foto Dureza Entrada" },
  { key: "photo_hardness_output", label: "Foto Dureza Salida" },
];

export default function RevisionDiaria() {
  const params = useParams();
  const router = useRouter();
  const poiId = params?.id as string;

  const [poiName, setPoiName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const [form, setForm] = useState({
    chlorine_input: "",
    chlorine_output: "",
    hardness_input: "",
    hardness_output: "",
    cylinder_weight: "",
    observations: "",
  });

  const [photos, setPhotos] = useState<Record<PhotoField, File | null>>({
    photo_chlorine_input: null,
    photo_chlorine_output: null,
    photo_hardness_input: null,
    photo_hardness_output: null,
  });

  const [previews, setPreviews] = useState<Record<PhotoField, string>>({
    photo_chlorine_input: "",
    photo_chlorine_output: "",
    photo_hardness_input: "",
    photo_hardness_output: "",
  });

  const fileInputRefs = useRef<Record<PhotoField, HTMLInputElement | null>>({
    photo_chlorine_input: null,
    photo_chlorine_output: null,
    photo_hardness_input: null,
    photo_hardness_output: null,
  });

  useEffect(() => {
    if (poiId) loadData();
  }, [poiId]);

  const loadData = async () => {
    setLoading(true);
    const { data: poi } = await supabase
      .from("poi")
      .select("name")
      .eq("id", poiId)
      .single();
    if (poi) setPoiName(poi.name);

    const todayStr = getTodayMexicoCity();
    const { data: existing } = await supabase
      .from("daily_reviews")
      .select("id")
      .eq("poi_id", poiId)
      .eq("review_date", todayStr)
      .maybeSingle();
    if (existing) setAlreadySubmitted(true);
    setLoading(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (key: PhotoField, file: File | null) => {
    setPhotos((prev) => ({ ...prev, [key]: file }));
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviews((prev) => ({ ...prev, [key]: url }));
    } else {
      setPreviews((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const removePhoto = (key: PhotoField) => {
    handlePhotoChange(key, null);
    if (fileInputRefs.current[key]) {
      fileInputRefs.current[key]!.value = "";
    }
  };

  const allPhotosAttached = PHOTO_FIELDS.every((f) => photos[f.key] !== null);

  const uploadPhoto = async (
    key: PhotoField,
    file: File
  ): Promise<string | null> => {
    const todayStr = getTodayMexicoCity();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${poiId}/${todayStr}/${key}.${ext}`;
    const contentType = file.type || "image/jpeg";

    const { error } = await supabase.storage
      .from("review-photos")
      .upload(path, file, { upsert: true, contentType });

    if (error) {
      console.error(`Error uploading ${key}:`, error);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("review-photos").getPublicUrl(path);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (alreadySubmitted || saving) return;
    if (
      !form.chlorine_input ||
      !form.chlorine_output ||
      !form.hardness_input ||
      !form.hardness_output ||
      !form.cylinder_weight
    )
      return;
    if (!allPhotosAttached) return;

    setSaving(true);
    const todayStr = getTodayMexicoCity();

    // Upload all 4 photos
    const photoUrls: Record<string, string | null> = {};
    for (const f of PHOTO_FIELDS) {
      const file = photos[f.key];
      if (!file) {
        setSaving(false);
        return;
      }
      photoUrls[f.key] = await uploadPhoto(f.key, file);
      if (!photoUrls[f.key]) {
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase.from("daily_reviews").insert([
      {
        poi_id: poiId,
        chlorine_residual: parseFloat(form.chlorine_input),
        chlorine_input: parseFloat(form.chlorine_input),
        chlorine_output: parseFloat(form.chlorine_output),
        hardness_input: parseFloat(form.hardness_input),
        hardness_output: parseFloat(form.hardness_output),
        cylinder_weight: parseFloat(form.cylinder_weight),
        observations: form.observations.trim() || null,
        review_date: todayStr,
        photo_chlorine_input: photoUrls.photo_chlorine_input,
        photo_chlorine_output: photoUrls.photo_chlorine_output,
        photo_hardness_input: photoUrls.photo_hardness_input,
        photo_hardness_output: photoUrls.photo_hardness_output,
      },
    ]);

    if (error) {
      console.error("Error al guardar revisión:", error);
      if (error.code === "23505") setAlreadySubmitted(true);
      setSaving(false);
      return;
    }

    // Update POI with latest readings
    await supabase
      .from("poi")
      .update({
        chlorine_input: parseFloat(form.chlorine_input),
        chlorine_output: parseFloat(form.chlorine_output),
        hardness_softener: parseFloat(form.hardness_input),
        hardness_product: parseFloat(form.hardness_output),
      })
      .eq("id", poiId);

    // Update assigned tank weight (if any)
    const cylinderWeight = parseFloat(form.cylinder_weight);
    const { data: assignedTank } = await supabase
      .from("tanks")
      .select("id")
      .eq("current_poi_id", poiId)
      .eq("status", "asignado")
      .maybeSingle();
    if (assignedTank) {
      await supabase
        .from("tanks")
        .update({ current_weight_kg: cylinderWeight })
        .eq("id", assignedTank.id);
      await supabase.from("tank_events").insert([
        {
          tank_id: assignedTank.id,
          event_type: "lectura_peso",
          poi_id: poiId,
          weight_kg: cylinderWeight,
          notes: "Lectura de revisión diaria",
        },
      ]);
    }

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
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Sección Cloro */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                Cloro
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cloro Entrada */}
                <div>
                  <label
                    htmlFor="chlorine_input"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Entrada
                  </label>
                  <div className="relative">
                    <input
                      id="chlorine_input"
                      name="chlorine_input"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      required
                      value={form.chlorine_input}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-16 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                      ppm
                    </span>
                  </div>
                  <PhotoInput
                    fieldKey="photo_chlorine_input"
                    preview={previews.photo_chlorine_input}
                    onFileChange={(file) =>
                      handlePhotoChange("photo_chlorine_input", file)
                    }
                    onRemove={() => removePhoto("photo_chlorine_input")}
                    inputRef={(el) => {
                      fileInputRefs.current.photo_chlorine_input = el;
                    }}
                  />
                </div>

                {/* Cloro Salida */}
                <div>
                  <label
                    htmlFor="chlorine_output"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Salida
                  </label>
                  <div className="relative">
                    <input
                      id="chlorine_output"
                      name="chlorine_output"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      required
                      value={form.chlorine_output}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-16 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                      ppm
                    </span>
                  </div>
                  <PhotoInput
                    fieldKey="photo_chlorine_output"
                    preview={previews.photo_chlorine_output}
                    onFileChange={(file) =>
                      handlePhotoChange("photo_chlorine_output", file)
                    }
                    onRemove={() => removePhoto("photo_chlorine_output")}
                    inputRef={(el) => {
                      fileInputRefs.current.photo_chlorine_output = el;
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Sección Dureza */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Dureza
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dureza Entrada */}
                <div>
                  <label
                    htmlFor="hardness_input"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Entrada
                  </label>
                  <div className="relative">
                    <input
                      id="hardness_input"
                      name="hardness_input"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      required
                      value={form.hardness_input}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-16 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                      ppm
                    </span>
                  </div>
                  <PhotoInput
                    fieldKey="photo_hardness_input"
                    preview={previews.photo_hardness_input}
                    onFileChange={(file) =>
                      handlePhotoChange("photo_hardness_input", file)
                    }
                    onRemove={() => removePhoto("photo_hardness_input")}
                    inputRef={(el) => {
                      fileInputRefs.current.photo_hardness_input = el;
                    }}
                  />
                </div>

                {/* Dureza Salida */}
                <div>
                  <label
                    htmlFor="hardness_output"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Salida
                  </label>
                  <div className="relative">
                    <input
                      id="hardness_output"
                      name="hardness_output"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      required
                      value={form.hardness_output}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-16 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                      ppm
                    </span>
                  </div>
                  <PhotoInput
                    fieldKey="photo_hardness_output"
                    preview={previews.photo_hardness_output}
                    onFileChange={(file) =>
                      handlePhotoChange("photo_hardness_output", file)
                    }
                    onRemove={() => removePhoto("photo_hardness_output")}
                    inputRef={(el) => {
                      fileInputRefs.current.photo_hardness_output = el;
                    }}
                  />
                </div>
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

            {/* Validación de fotos */}
            {!allPhotosAttached && (
              <p className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                Debes adjuntar las 4 fotografías para poder finalizar la
                revisión.
              </p>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={saving || !allPhotosAttached}
              className="w-full bg-dtm-blue text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Subiendo fotos y registrando..." : "Finalizar Registro"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function PhotoInput({
  fieldKey,
  preview,
  onFileChange,
  onRemove,
  inputRef,
}: {
  fieldKey: string;
  preview: string;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        id={`file-${fieldKey}`}
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          onFileChange(file);
        }}
      />
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-28 object-cover rounded-lg border border-gray-200"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={`file-${fieldKey}`}
          className="flex items-center justify-center gap-2 w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-dtm-blue hover:bg-blue-50 transition text-sm text-gray-500"
        >
          <Camera className="w-4 h-4" />
          Adjuntar foto
        </label>
      )}
    </div>
  );
}
