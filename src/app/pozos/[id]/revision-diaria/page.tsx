"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import {
  ArrowLeft,
  CheckCircle2,
  Camera,
  X,
  AlertTriangle,
  Wrench,
} from "lucide-react";
import Link from "next/link";

const CHLORINE_UPPER_THRESHOLD = 1.5; // mg/L

function getTodayMexicoCity(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });
}

type Tank = { id: string; identifier: string };

export default function RevisionDiariaPozo() {
  const params = useParams();
  const poziId = params?.id as string;

  const [pozoName, setPozoName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [assignedTank, setAssignedTank] = useState<Tank | null>(null);

  const [form, setForm] = useState({
    chlorine_residual: "",
    cylinder_weight: "",
    observations: "",
  });

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Maintenance event toggles
  const [raiseEvent, setRaiseEvent] = useState(false);
  const [eventType, setEventType] = useState<
    "cloro_alto" | "cloro_bajo" | "clorador_danado" | "otro"
  >("cloro_alto");
  const [eventDescription, setEventDescription] = useState("");
  const [chloratorDamaged, setChloratorDamaged] = useState(false);

  useEffect(() => {
    if (poziId) loadData();
  }, [poziId]);

  const loadData = async () => {
    setLoading(true);
    const { data: p } = await supabase
      .from("pozos")
      .select("identifier")
      .eq("id", poziId)
      .single();
    if (p) setPozoName(p.identifier);

    const today = getTodayMexicoCity();
    const { data: existing } = await supabase
      .from("well_daily_reviews")
      .select("id")
      .eq("pozo_id", poziId)
      .eq("review_date", today)
      .maybeSingle();
    if (existing) setAlreadySubmitted(true);

    const { data: t } = await supabase
      .from("tanks")
      .select("id, identifier")
      .eq("current_pozo_id", poziId)
      .eq("status", "asignado")
      .maybeSingle();
    setAssignedTank((t as Tank) || null);

    setLoading(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (file: File | null) => {
    setPhoto(file);
    if (file) setPreview(URL.createObjectURL(file));
    else setPreview("");
  };

  const removePhoto = () => {
    handlePhotoChange(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const today = getTodayMexicoCity();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `wells/${poziId}/${today}/cloro.${ext}`;
    const { error } = await supabase.storage
      .from("review-photos")
      .upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
    if (error) {
      console.error(error);
      return null;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("review-photos").getPublicUrl(path);
    return publicUrl;
  };

  const chlorineNum = parseFloat(form.chlorine_residual);
  const exceedsThreshold =
    !isNaN(chlorineNum) && chlorineNum > CHLORINE_UPPER_THRESHOLD;
  const shouldSuggestEvent = exceedsThreshold || chloratorDamaged;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (alreadySubmitted || saving) return;
    if (!form.chlorine_residual || !photo) return;

    setSaving(true);
    const today = getTodayMexicoCity();

    const photoUrl = await uploadPhoto(photo);
    if (!photoUrl) {
      setSaving(false);
      return;
    }

    const { data: review, error } = await supabase
      .from("well_daily_reviews")
      .insert([
        {
          pozo_id: poziId,
          review_date: today,
          chlorine_residual: chlorineNum,
          photo_url: photoUrl,
          cylinder_weight: form.cylinder_weight
            ? parseFloat(form.cylinder_weight)
            : null,
          observations: form.observations.trim() || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      if (error.code === "23505") setAlreadySubmitted(true);
      setSaving(false);
      return;
    }

    // Update pozo last reading
    await supabase
      .from("pozos")
      .update({ last_chlorine_residual: chlorineNum })
      .eq("id", poziId);

    // Update assigned tank weight if provided
    if (assignedTank && form.cylinder_weight) {
      const w = parseFloat(form.cylinder_weight);
      await supabase
        .from("tanks")
        .update({ current_weight_kg: w })
        .eq("id", assignedTank.id);
      await supabase.from("tank_events").insert([
        {
          tank_id: assignedTank.id,
          event_type: "lectura_peso",
          pozo_id: poziId,
          weight_kg: w,
          notes: "Lectura de revisión diaria de pozo",
        },
      ]);
    }

    // Maintenance event(s)
    const events: any[] = [];
    if (chloratorDamaged) {
      events.push({
        source_type: "pozo",
        pozo_id: poziId,
        event_type: "clorador_danado",
        description: eventDescription.trim() || null,
        related_review_id: review.id,
      });
    }
    if (raiseEvent && !chloratorDamaged) {
      events.push({
        source_type: "pozo",
        pozo_id: poziId,
        event_type: eventType,
        description: eventDescription.trim() || null,
        related_review_id: review.id,
      });
    } else if (raiseEvent && chloratorDamaged && eventType !== "clorador_danado") {
      events.push({
        source_type: "pozo",
        pozo_id: poziId,
        event_type: eventType,
        description: eventDescription.trim() || null,
        related_review_id: review.id,
      });
    }
    if (events.length > 0) {
      await supabase.from("maintenance_events").insert(events);
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
        href={`/pozos/${poziId}`}
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a {pozoName}
      </Link>

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">
          Revisión Diaria de Pozo
        </h1>
        <p className="text-gray-500 mb-6">
          {pozoName} —{" "}
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
              Ya se registró la revisión de hoy. El siguiente registro estará
              disponible mañana a las 00:01 hrs (hora CDMX).
            </p>
            <Link
              href={`/pozos/${poziId}`}
              className="inline-block mt-6 bg-dtm-blue text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors"
            >
              Volver al Pozo
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cloro residual */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cloro residual
              </label>
              <div className="relative">
                <input
                  name="chlorine_residual"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  required
                  value={form.chlorine_residual}
                  onChange={handleChange}
                  placeholder="0.00"
                  className={`w-full border rounded-lg px-4 py-3 pr-16 text-gray-800 focus:outline-none focus:ring-2 focus:border-transparent transition ${
                    exceedsThreshold
                      ? "border-red-300 focus:ring-red-400 bg-red-50"
                      : "border-gray-300 focus:ring-dtm-blue"
                  }`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                  mg/L
                </span>
              </div>
              {exceedsThreshold && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Excede el umbral recomendado ({CHLORINE_UPPER_THRESHOLD}{" "}
                  mg/L). Considera levantar un evento de mantenimiento.
                </p>
              )}
            </div>

            {/* Foto evidencia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Foto de evidencia
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                id="cloro-photo"
                onChange={(e) =>
                  handlePhotoChange(e.target.files?.[0] || null)
                }
              />
              {preview ? (
                <div className="relative">
                  <img
                    src={preview}
                    alt=""
                    className="w-full h-48 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="cloro-photo"
                  className="flex items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-dtm-blue hover:bg-blue-50 transition text-sm text-gray-500"
                >
                  <Camera className="w-4 h-4" />
                  Adjuntar foto del muestreo
                </label>
              )}
            </div>

            {/* Peso del tanque */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Peso actual del tanque de gas-cloro
              </label>
              {assignedTank && (
                <p className="text-xs text-gray-500 mb-2">
                  Tanque asignado:{" "}
                  <span className="font-semibold">
                    {assignedTank.identifier}
                  </span>{" "}
                  — actualizará automáticamente el peso registrado.
                </p>
              )}
              <div className="relative">
                <input
                  name="cylinder_weight"
                  type="number"
                  inputMode="decimal"
                  step="any"
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

            {/* Sistema clorador dañado */}
            <div className="border border-gray-200 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chloratorDamaged}
                  onChange={(e) => setChloratorDamaged(e.target.checked)}
                  className="mt-1 w-4 h-4 text-dtm-blue rounded"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Sistema clorador dañado
                  </p>
                  <p className="text-xs text-gray-500">
                    Marcar si se detectó alguna falla en el sistema. Se generará
                    automáticamente un evento de mantenimiento.
                  </p>
                </div>
              </label>
            </div>

            {/* Levantar evento opcional */}
            <div
              className={`border rounded-xl p-4 ${
                shouldSuggestEvent
                  ? "border-amber-300 bg-amber-50"
                  : "border-gray-200"
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={raiseEvent}
                  onChange={(e) => setRaiseEvent(e.target.checked)}
                  className="mt-1 w-4 h-4 text-amber-600 rounded"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-600" />
                    Levantar evento de mantenimiento adicional
                  </p>
                  <p className="text-xs text-gray-500">
                    {shouldSuggestEvent
                      ? "Se sugiere por el cloro fuera de rango o falla del clorador."
                      : "Marca si necesitas reportar otra incidencia."}
                  </p>
                </div>
              </label>

              {raiseEvent && (
                <div className="mt-4 space-y-3 pl-7">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tipo de evento
                    </label>
                    <select
                      value={eventType}
                      onChange={(e) =>
                        setEventType(e.target.value as typeof eventType)
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="cloro_alto">Cloro residual alto</option>
                      <option value="cloro_bajo">Cloro residual bajo</option>
                      <option value="clorador_danado">
                        Sistema clorador dañado
                      </option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Descripción
                    </label>
                    <textarea
                      rows={2}
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      placeholder="Detalla el problema..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <textarea
                name="observations"
                rows={3}
                value={form.observations}
                onChange={handleChange}
                placeholder="Notas adicionales..."
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue focus:border-transparent transition resize-none"
              />
            </div>

            {!photo && (
              <p className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                Debes adjuntar la foto de evidencia para finalizar.
              </p>
            )}

            <button
              type="submit"
              disabled={saving || !photo || !form.chlorine_residual}
              className="w-full bg-dtm-blue text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Guardando..." : "Finalizar Registro"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
