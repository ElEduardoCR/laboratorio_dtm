"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import {
  ArrowLeft,
  CheckCircle2,
  Camera,
  Video,
  X,
  AlertTriangle,
  Power,
  PowerOff,
} from "lucide-react";
import Link from "next/link";

function getTodayMexicoCity(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });
}

type MediaKey =
  | "coin_clean_photo"
  | "coin_collection_photo"
  | "salt_photo"
  | "tank_input_video"
  | "tank_output_video"
  | "multimedia_filter_photo"
  | "carbon_filter_photo"
  | "resin_filter_photo"
  | "sediment_filter_photo"
  | "ro_system_photo"
  | "bigblue_filter_photo"
  | "uv_lamp_photo";

type MediaType = "image" | "video";

type Status = "green" | "yellow" | "red" | "";

const STATUS_OPTIONS: { value: Status; label: string; color: string }[] = [
  { value: "green", label: "Buen estado", color: "bg-green-500" },
  { value: "yellow", label: "Próximo a cambio", color: "bg-yellow-500" },
  { value: "red", label: "Necesita mantenimiento", color: "bg-red-500" },
];

export default function RevisionSemanal() {
  const params = useParams();
  const poiId = params?.id as string;

  const [poiName, setPoiName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [outOfService, setOutOfService] = useState(false);

  // Inicial: null = no decidido, true = operacional, false = fuera de servicio
  const [isOperational, setIsOperational] = useState<boolean | null>(null);

  const [form, setForm] = useState({
    salt_supplied_kg: "",
    salt_emptied_kg: "",
    collection_amount: "",
    multimedia_filter_status: "" as Status,
    carbon_filter_status: "" as Status,
    resin_filter_status: "" as Status,
    bigblue_filter_status: "" as Status,
    observations: "",
  });

  const [media, setMedia] = useState<Record<MediaKey, File | null>>({
    coin_clean_photo: null,
    coin_collection_photo: null,
    salt_photo: null,
    tank_input_video: null,
    tank_output_video: null,
    multimedia_filter_photo: null,
    carbon_filter_photo: null,
    resin_filter_photo: null,
    sediment_filter_photo: null,
    ro_system_photo: null,
    bigblue_filter_photo: null,
    uv_lamp_photo: null,
  });

  const [previews, setPreviews] = useState<Record<MediaKey, string>>({
    coin_clean_photo: "",
    coin_collection_photo: "",
    salt_photo: "",
    tank_input_video: "",
    tank_output_video: "",
    multimedia_filter_photo: "",
    carbon_filter_photo: "",
    resin_filter_photo: "",
    sediment_filter_photo: "",
    ro_system_photo: "",
    bigblue_filter_photo: "",
    uv_lamp_photo: "",
  });

  const fileInputRefs = useRef<Record<MediaKey, HTMLInputElement | null>>({
    coin_clean_photo: null,
    coin_collection_photo: null,
    salt_photo: null,
    tank_input_video: null,
    tank_output_video: null,
    multimedia_filter_photo: null,
    carbon_filter_photo: null,
    resin_filter_photo: null,
    sediment_filter_photo: null,
    ro_system_photo: null,
    bigblue_filter_photo: null,
    uv_lamp_photo: null,
  });

  useEffect(() => {
    if (poiId) loadData();
  }, [poiId]);

  const loadData = async () => {
    setLoading(true);
    const { data: poi } = await supabase
      .from("poi")
      .select("name, is_operational")
      .eq("id", poiId)
      .single();
    if (poi) {
      setPoiName(poi.name);
      if (poi.is_operational === false) setOutOfService(true);
    }
    setLoading(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleMediaChange = (key: MediaKey, file: File | null) => {
    setMedia((prev) => ({ ...prev, [key]: file }));
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviews((prev) => ({ ...prev, [key]: url }));
    } else {
      setPreviews((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const removeMedia = (key: MediaKey) => {
    handleMediaChange(key, null);
    if (fileInputRefs.current[key]) {
      fileInputRefs.current[key]!.value = "";
    }
  };

  const uploadMedia = async (
    key: MediaKey,
    file: File
  ): Promise<string | null> => {
    const todayStr = getTodayMexicoCity();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${poiId}/semanal/${todayStr}/${key}.${ext}`;
    const contentType = file.type || "application/octet-stream";

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

  // Submit cuando la planta está fuera de servicio
  const handleSubmitOutOfService = async () => {
    if (saving) return;
    setSaving(true);
    const todayStr = getTodayMexicoCity();

    const { error } = await supabase.from("weekly_reviews").insert([
      {
        poi_id: poiId,
        review_date: todayStr,
        is_operational: false,
        observations: form.observations.trim() || null,
      },
    ]);

    if (error) {
      console.error("Error al guardar revisión semanal:", error);
      setSaving(false);
      return;
    }

    await supabase
      .from("poi")
      .update({ is_operational: false })
      .eq("id", poiId);

    setOutOfService(true);
    setSubmitted(true);
    setSaving(false);
  };

  // Submit revisión completa
  const allMediaAttached = (Object.keys(media) as MediaKey[]).every(
    (k) => media[k] !== null
  );

  const allStatusSet =
    form.multimedia_filter_status !== "" &&
    form.carbon_filter_status !== "" &&
    form.resin_filter_status !== "" &&
    form.bigblue_filter_status !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || submitted) return;
    if (!form.salt_supplied_kg || !form.salt_emptied_kg) return;
    if (!allStatusSet || !allMediaAttached) return;

    setSaving(true);
    const todayStr = getTodayMexicoCity();

    const mediaUrls: Record<string, string | null> = {};
    for (const key of Object.keys(media) as MediaKey[]) {
      const file = media[key];
      if (!file) {
        setSaving(false);
        return;
      }
      mediaUrls[key] = await uploadMedia(key, file);
      if (!mediaUrls[key]) {
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase.from("weekly_reviews").insert([
      {
        poi_id: poiId,
        review_date: todayStr,
        is_operational: true,
        salt_supplied_kg: parseFloat(form.salt_supplied_kg),
        salt_emptied_kg: parseFloat(form.salt_emptied_kg),
        collection_amount: form.collection_amount
          ? parseFloat(form.collection_amount)
          : null,
        multimedia_filter_status: form.multimedia_filter_status,
        carbon_filter_status: form.carbon_filter_status,
        resin_filter_status: form.resin_filter_status,
        bigblue_filter_status: form.bigblue_filter_status,
        observations: form.observations.trim() || null,
        coin_clean_photo: mediaUrls.coin_clean_photo,
        coin_collection_photo: mediaUrls.coin_collection_photo,
        salt_photo: mediaUrls.salt_photo,
        tank_input_video: mediaUrls.tank_input_video,
        tank_output_video: mediaUrls.tank_output_video,
        multimedia_filter_photo: mediaUrls.multimedia_filter_photo,
        carbon_filter_photo: mediaUrls.carbon_filter_photo,
        resin_filter_photo: mediaUrls.resin_filter_photo,
        sediment_filter_photo: mediaUrls.sediment_filter_photo,
        ro_system_photo: mediaUrls.ro_system_photo,
        bigblue_filter_photo: mediaUrls.bigblue_filter_photo,
        uv_lamp_photo: mediaUrls.uv_lamp_photo,
      },
    ]);

    if (error) {
      console.error("Error al guardar revisión semanal:", error);
      setSaving(false);
      return;
    }

    setSubmitted(true);
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
    <div className="w-full max-w-3xl mx-auto py-8">
      <Link
        href={`/poi/${poiId}`}
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a {poiName}
      </Link>

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-800">Revisión Semanal</h1>
          {outOfService && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-3 h-3" />
              Fuera de Servicio
            </span>
          )}
        </div>
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

        {submitted ? (
          <div className="text-center py-10">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              {isOperational === false
                ? "Planta marcada como Fuera de Servicio"
                : "Revisión Semanal Registrada"}
            </h2>
            <p className="text-gray-500 max-w-sm mx-auto">
              {isOperational === false
                ? "La operación ha finalizado. La reactivación se hará desde un módulo dedicado."
                : "La revisión semanal se guardó correctamente."}
            </p>
            <Link
              href={`/poi/${poiId}`}
              className="inline-block mt-6 bg-dtm-blue text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors"
            >
              Volver a la Planta
            </Link>
          </div>
        ) : isOperational === null ? (
          // Selector inicial: ¿la planta está en funcionamiento?
          <div className="py-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Estado actual de la planta
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Antes de iniciar la revisión, indica si la planta se encuentra
              operativa.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setIsOperational(true)}
                className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-green-200 bg-green-50 rounded-2xl hover:border-green-500 hover:bg-green-100 transition"
              >
                <Power className="w-10 h-10 text-green-600" />
                <span className="font-semibold text-green-800">
                  En operación
                </span>
                <span className="text-xs text-green-600 text-center">
                  Continuar con la revisión completa
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIsOperational(false)}
                className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-red-200 bg-red-50 rounded-2xl hover:border-red-500 hover:bg-red-100 transition"
              >
                <PowerOff className="w-10 h-10 text-red-600" />
                <span className="font-semibold text-red-800">
                  Fuera de servicio
                </span>
                <span className="text-xs text-red-600 text-center">
                  Marcar planta como inactiva
                </span>
              </button>
            </div>
          </div>
        ) : isOperational === false ? (
          // Flujo: marcar como fuera de servicio
          <div className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                Estás por marcar la planta como{" "}
                <strong>fuera de servicio</strong>. Al finalizar, quedará
                registrada como inactiva y solo podrá reactivarse desde el
                módulo correspondiente.
              </div>
            </div>

            <div>
              <label
                htmlFor="observations"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Motivo / Observaciones
              </label>
              <textarea
                id="observations"
                name="observations"
                rows={4}
                value={form.observations}
                onChange={handleChange}
                placeholder="Describe el motivo por el cual la planta está fuera de servicio..."
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setIsOperational(null)}
                className="flex-1 bg-white text-gray-700 border-2 border-gray-300 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitOutOfService}
                disabled={saving}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando..." : "Finalizar Operación"}
              </button>
            </div>
          </div>
        ) : (
          // Formulario completo de revisión semanal
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* 1. Sistema de Monedas */}
            <Section
              number={1}
              title="Sistema de Monedas"
              color="bg-amber-500"
            >
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                <strong>Instrucciones:</strong> Limpia el sistema de monedas y
                verifica su correcto funcionamiento. Sube una foto que evidencie
                la limpieza y otra de la recaudación obtenida.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MediaInput
                  fieldKey="coin_clean_photo"
                  label="Foto: Sistema limpio"
                  type="image"
                  preview={previews.coin_clean_photo}
                  onFileChange={(f) => handleMediaChange("coin_clean_photo", f)}
                  onRemove={() => removeMedia("coin_clean_photo")}
                  inputRef={(el) => {
                    fileInputRefs.current.coin_clean_photo = el;
                  }}
                />
                <MediaInput
                  fieldKey="coin_collection_photo"
                  label="Foto: Recaudación"
                  type="image"
                  preview={previews.coin_collection_photo}
                  onFileChange={(f) =>
                    handleMediaChange("coin_collection_photo", f)
                  }
                  onRemove={() => removeMedia("coin_collection_photo")}
                  inputRef={(el) => {
                    fileInputRefs.current.coin_collection_photo = el;
                  }}
                />
              </div>
              <div className="mt-4">
                <label
                  htmlFor="collection_amount"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Monto recaudado (MXN)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    id="collection_amount"
                    name="collection_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={form.collection_amount}
                    onChange={(e) =>
                      setForm({ ...form, collection_amount: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Dinero retirado del monedero esta semana.
                </p>
              </div>
            </Section>

            {/* 2. Revisión de Sal */}
            <Section number={2} title="Revisión de Sal" color="bg-cyan-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Surtido
                  </label>
                  <div className="relative">
                    <input
                      name="salt_supplied_kg"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      required
                      value={form.salt_supplied_kg}
                      onChange={handleChange}
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
                    Vaciado
                  </label>
                  <div className="relative">
                    <input
                      name="salt_emptied_kg"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      required
                      value={form.salt_emptied_kg}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                      KG
                    </span>
                  </div>
                </div>
              </div>
              <MediaInput
                fieldKey="salt_photo"
                label="Foto del depósito de sal"
                type="image"
                preview={previews.salt_photo}
                onFileChange={(f) => handleMediaChange("salt_photo", f)}
                onRemove={() => removeMedia("salt_photo")}
                inputRef={(el) => {
                  fileInputRefs.current.salt_photo = el;
                }}
              />
            </Section>

            {/* 3. Tanques */}
            <Section number={3} title="Tanques" color="bg-blue-500">
              <p className="text-sm text-gray-600 mb-4">
                Limpia los tanques y graba un video corto en cada uno donde se
                vea la limpieza y el correcto funcionamiento del flotador.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MediaInput
                  fieldKey="tank_input_video"
                  label="Video: Tanque de Entrada"
                  type="video"
                  preview={previews.tank_input_video}
                  onFileChange={(f) => handleMediaChange("tank_input_video", f)}
                  onRemove={() => removeMedia("tank_input_video")}
                  inputRef={(el) => {
                    fileInputRefs.current.tank_input_video = el;
                  }}
                />
                <MediaInput
                  fieldKey="tank_output_video"
                  label="Video: Tanque de Salida"
                  type="video"
                  preview={previews.tank_output_video}
                  onFileChange={(f) =>
                    handleMediaChange("tank_output_video", f)
                  }
                  onRemove={() => removeMedia("tank_output_video")}
                  inputRef={(el) => {
                    fileInputRefs.current.tank_output_video = el;
                  }}
                />
              </div>
            </Section>

            {/* 4. Pretratamiento */}
            <Section number={4} title="Pretratamiento" color="bg-purple-500">
              <p className="text-sm text-gray-600 mb-4">
                Revisa cada filtro y selecciona el estado en el semáforo. Adjunta
                una foto por filtro.
              </p>
              <div className="space-y-6">
                <FilterBlock
                  title="Filtro Multimedia"
                  status={form.multimedia_filter_status}
                  onStatusChange={(s) =>
                    setForm({ ...form, multimedia_filter_status: s })
                  }
                  fieldKey="multimedia_filter_photo"
                  preview={previews.multimedia_filter_photo}
                  onFileChange={(f) =>
                    handleMediaChange("multimedia_filter_photo", f)
                  }
                  onRemove={() => removeMedia("multimedia_filter_photo")}
                  inputRef={(el) => {
                    fileInputRefs.current.multimedia_filter_photo = el;
                  }}
                />
                <FilterBlock
                  title="Filtro de Carbón"
                  status={form.carbon_filter_status}
                  onStatusChange={(s) =>
                    setForm({ ...form, carbon_filter_status: s })
                  }
                  fieldKey="carbon_filter_photo"
                  preview={previews.carbon_filter_photo}
                  onFileChange={(f) =>
                    handleMediaChange("carbon_filter_photo", f)
                  }
                  onRemove={() => removeMedia("carbon_filter_photo")}
                  inputRef={(el) => {
                    fileInputRefs.current.carbon_filter_photo = el;
                  }}
                />
                <FilterBlock
                  title="Filtro de Resina"
                  status={form.resin_filter_status}
                  onStatusChange={(s) =>
                    setForm({ ...form, resin_filter_status: s })
                  }
                  fieldKey="resin_filter_photo"
                  preview={previews.resin_filter_photo}
                  onFileChange={(f) =>
                    handleMediaChange("resin_filter_photo", f)
                  }
                  onRemove={() => removeMedia("resin_filter_photo")}
                  inputRef={(el) => {
                    fileInputRefs.current.resin_filter_photo = el;
                  }}
                />
              </div>
            </Section>

            {/* 5. Filtro de Sedimentos */}
            <Section
              number={5}
              title="Filtro de Sedimentos"
              color="bg-orange-500"
            >
              <MediaInput
                fieldKey="sediment_filter_photo"
                label="Foto del filtro de sedimentos"
                type="image"
                preview={previews.sediment_filter_photo}
                onFileChange={(f) =>
                  handleMediaChange("sediment_filter_photo", f)
                }
                onRemove={() => removeMedia("sediment_filter_photo")}
                inputRef={(el) => {
                  fileInputRefs.current.sediment_filter_photo = el;
                }}
              />
            </Section>

            {/* 6. Sistema de Osmosis Inversa */}
            <Section
              number={6}
              title="Sistema de Osmosis Inversa"
              color="bg-teal-500"
            >
              <p className="text-sm text-gray-600 mb-4">
                Toma una foto del sistema en funcionamiento donde se vean los 2
                flujómetros. Verifica que ambos estén al 50% (50% rechazado /
                50% aceptado).
              </p>
              <MediaInput
                fieldKey="ro_system_photo"
                label="Foto: Sistema OI con flujómetros"
                type="image"
                preview={previews.ro_system_photo}
                onFileChange={(f) => handleMediaChange("ro_system_photo", f)}
                onRemove={() => removeMedia("ro_system_photo")}
                inputRef={(el) => {
                  fileInputRefs.current.ro_system_photo = el;
                }}
              />
            </Section>

            {/* 7. Filtro BigBlue */}
            <Section number={7} title="Filtro BigBlue" color="bg-indigo-500">
              <p className="text-sm text-gray-600 mb-4">
                Verifica la salida de la dureza y selecciona el estado del
                filtro.
              </p>
              <FilterBlock
                title="Filtro BigBlue"
                status={form.bigblue_filter_status}
                onStatusChange={(s) =>
                  setForm({ ...form, bigblue_filter_status: s })
                }
                fieldKey="bigblue_filter_photo"
                preview={previews.bigblue_filter_photo}
                onFileChange={(f) =>
                  handleMediaChange("bigblue_filter_photo", f)
                }
                onRemove={() => removeMedia("bigblue_filter_photo")}
                inputRef={(el) => {
                  fileInputRefs.current.bigblue_filter_photo = el;
                }}
                hideTitle
              />
            </Section>

            {/* 8. Lámpara UV */}
            <Section number={8} title="Lámpara UV" color="bg-violet-500">
              <p className="text-sm text-gray-600 mb-4">
                Toma una foto del balastro para evaluar si requiere cambio.
              </p>
              <MediaInput
                fieldKey="uv_lamp_photo"
                label="Foto del balastro"
                type="image"
                preview={previews.uv_lamp_photo}
                onFileChange={(f) => handleMediaChange("uv_lamp_photo", f)}
                onRemove={() => removeMedia("uv_lamp_photo")}
                inputRef={(el) => {
                  fileInputRefs.current.uv_lamp_photo = el;
                }}
              />
            </Section>

            {/* Observaciones */}
            <div>
              <label
                htmlFor="observations"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Observaciones generales
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

            {/* Validaciones */}
            {(!allStatusSet || !allMediaAttached) && (
              <p className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
                Debes seleccionar el estado de los 4 filtros y adjuntar todas
                las fotos y videos para finalizar la revisión.
              </p>
            )}

            <button
              type="submit"
              disabled={saving || !allMediaAttached || !allStatusSet}
              className="w-full bg-dtm-blue text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Subiendo evidencia y registrando..." : "Finalizar Revisión Semanal"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  color,
  children,
}: {
  number: number;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <span
          className={`w-7 h-7 rounded-full ${color} text-white flex items-center justify-center text-sm font-bold`}
        >
          {number}
        </span>
        {title}
      </h2>
      <div className="pl-1">{children}</div>
    </div>
  );
}

function FilterBlock({
  title,
  status,
  onStatusChange,
  fieldKey,
  preview,
  onFileChange,
  onRemove,
  inputRef,
  hideTitle = false,
}: {
  title: string;
  status: Status;
  onStatusChange: (s: Status) => void;
  fieldKey: MediaKey;
  preview: string;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
  hideTitle?: boolean;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4">
      {!hideTitle && (
        <p className="font-medium text-gray-800 mb-3">{title}</p>
      )}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onStatusChange(opt.value)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition ${
              status === opt.value
                ? "border-gray-800 bg-gray-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className={`w-5 h-5 rounded-full ${opt.color}`}></span>
            <span className="text-[11px] text-gray-600 text-center leading-tight">
              {opt.label}
            </span>
          </button>
        ))}
      </div>
      <MediaInput
        fieldKey={fieldKey}
        label="Foto del filtro"
        type="image"
        preview={preview}
        onFileChange={onFileChange}
        onRemove={onRemove}
        inputRef={inputRef}
      />
    </div>
  );
}

function MediaInput({
  fieldKey,
  label,
  type,
  preview,
  onFileChange,
  onRemove,
  inputRef,
}: {
  fieldKey: string;
  label: string;
  type: MediaType;
  preview: string;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const accept = type === "video" ? "video/*" : "image/*";
  const Icon = type === "video" ? Video : Camera;
  const placeholder = type === "video" ? "Adjuntar video" : "Adjuntar foto";

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={type === "video" ? "environment" : undefined}
        className="hidden"
        id={`file-${fieldKey}`}
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          onFileChange(file);
        }}
      />
      {preview ? (
        <div className="relative">
          {type === "video" ? (
            <video
              src={preview}
              controls
              className="w-full h-40 object-cover rounded-lg border border-gray-200 bg-black"
            />
          ) : (
            <img
              src={preview}
              alt="Preview"
              className="w-full h-32 object-cover rounded-lg border border-gray-200"
            />
          )}
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
          className="flex items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-dtm-blue hover:bg-blue-50 transition text-sm text-gray-500"
        >
          <Icon className="w-4 h-4" />
          {placeholder}
        </label>
      )}
    </div>
  );
}
