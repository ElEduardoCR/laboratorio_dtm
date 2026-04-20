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
  Clock,
  Save,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const CHLORINE_UPPER_THRESHOLD = 1.5;

function getTodayMexicoCity(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });
}

type Pozo = {
  id: string;
  identifier: string;
  kind: "urbano" | "rural" | null;
  chlorination_type: "gas_cloro" | "hipoclorito" | null;
};
type Point = { id: string; address: string; position: number };
type Tank = { id: string; identifier: string };
type Review = {
  id: string;
  sampling_point_id: string | null;
  chlorine_residual: number;
  sample_time: string | null;
  signed_by: string | null;
};
type SignerName = { id: string; full_name: string };
type Hipoclorito = { id: string; current_qty: number };

export default function RevisionDiariaPozo() {
  const params = useParams();
  const poziId = params?.id as string;
  const { session, profile } = useAuth();

  const [pozo, setPozo] = useState<Pozo | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [signers, setSigners] = useState<Record<string, string>>({});
  const [assignedTank, setAssignedTank] = useState<Tank | null>(null);
  const [hipoSku, setHipoSku] = useState<Hipoclorito | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (poziId) loadData();
  }, [poziId]);

  const loadData = async () => {
    setLoading(true);
    const { data: p } = await supabase
      .from("pozos")
      .select("id, identifier, kind, chlorination_type")
      .eq("id", poziId)
      .single();
    setPozo((p as Pozo) || null);

    const { data: ps } = await supabase
      .from("pozo_sampling_points")
      .select("id, address, position")
      .eq("pozo_id", poziId)
      .order("position");
    setPoints((ps as Point[]) || []);

    const today = getTodayMexicoCity();
    const { data: rs } = await supabase
      .from("well_daily_reviews")
      .select("id, sampling_point_id, chlorine_residual, sample_time, signed_by")
      .eq("pozo_id", poziId)
      .eq("review_date", today);
    setReviews((rs as Review[]) || []);

    const ids = ((rs as Review[]) || [])
      .map((r) => r.signed_by)
      .filter((x): x is string => !!x);
    if (ids.length > 0) {
      const { data: us } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", ids);
      const map: Record<string, string> = {};
      ((us as SignerName[]) || []).forEach((u) => {
        map[u.id] = u.full_name;
      });
      setSigners(map);
    }

    if (p?.chlorination_type === "gas_cloro") {
      const { data: t } = await supabase
        .from("tanks")
        .select("id, identifier")
        .eq("current_pozo_id", poziId)
        .eq("status", "asignado")
        .maybeSingle();
      setAssignedTank((t as Tank) || null);
    }

    if (p?.chlorination_type === "hipoclorito") {
      const { data: h } = await supabase
        .from("inventory_items")
        .select("id, current_qty")
        .eq("is_hipoclorito", true)
        .maybeSingle();
      setHipoSku((h as Hipoclorito) || null);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dtm-blue"></div>
      </div>
    );
  }
  if (!pozo) return null;

  const reviewsByPoint = new Map(reviews.map((r) => [r.sampling_point_id, r]));

  return (
    <div className="w-full max-w-3xl mx-auto py-8">
      <Link
        href={`/pozos/${poziId}`}
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a {pozo.identifier}
      </Link>

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-800">
            Revisión Diaria de Pozo
          </h1>
          <span
            className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${
              pozo.chlorination_type === "hipoclorito"
                ? "bg-amber-100 text-amber-700"
                : "bg-sky-100 text-sky-700"
            }`}
          >
            {pozo.chlorination_type === "hipoclorito"
              ? "Hipoclorito"
              : "Tanque gas-cloro"}
            {pozo.kind && ` · ${pozo.kind}`}
          </span>
        </div>
        <p className="text-gray-500 mb-6">
          {pozo.identifier} —{" "}
          {new Date().toLocaleDateString("es-MX", {
            timeZone: "America/Mexico_City",
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        {points.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
            Este pozo no tiene ubicaciones de muestreo registradas. Edítalo y
            agrega al menos una ubicación.
          </div>
        ) : (
          <div className="space-y-4">
            {points.map((point) => (
              <SamplingPointRow
                key={point.id}
                pozoId={poziId}
                point={point}
                existing={reviewsByPoint.get(point.id) || null}
                signerName={
                  reviewsByPoint.get(point.id)?.signed_by
                    ? signers[reviewsByPoint.get(point.id)!.signed_by!]
                    : null
                }
                userId={session?.user?.id || null}
                userName={profile?.full_name || ""}
                onSaved={loadData}
              />
            ))}
          </div>
        )}

        {pozo.chlorination_type === "gas_cloro" && assignedTank && (
          <TankWeightSection
            pozoId={poziId}
            tank={assignedTank}
            userId={session?.user?.id || null}
            onSaved={loadData}
          />
        )}

        {pozo.chlorination_type === "hipoclorito" && (
          <HipocloritoSection
            pozoId={poziId}
            sku={hipoSku}
            userId={session?.user?.id || null}
            onSaved={loadData}
          />
        )}
      </div>
    </div>
  );
}

function SamplingPointRow({
  pozoId,
  point,
  existing,
  signerName,
  userId,
  userName,
  onSaved,
}: {
  pozoId: string;
  point: Point;
  existing: Review | null;
  signerName: string | null;
  userId: string | null;
  userName: string;
  onSaved: () => void;
}) {
  const [chlorine, setChlorine] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const value = parseFloat(chlorine);
  const exceeds = !isNaN(value) && value > CHLORINE_UPPER_THRESHOLD;

  const setFile = (f: File | null) => {
    setPhoto(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  };

  const upload = async (file: File): Promise<string | null> => {
    const today = getTodayMexicoCity();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `wells/${pozoId}/${today}/${point.id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("review-photos")
      .upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
    if (upErr) return null;
    const {
      data: { publicUrl },
    } = supabase.storage.from("review-photos").getPublicUrl(path);
    return publicUrl;
  };

  const submit = async () => {
    setError(null);
    if (!chlorine || isNaN(value)) {
      setError("Captura un valor de cloro residual.");
      return;
    }
    if (!photo) {
      setError("Adjunta la foto de evidencia.");
      return;
    }
    setSaving(true);
    const photoUrl = await upload(photo);
    if (!photoUrl) {
      setError("No se pudo subir la foto.");
      setSaving(false);
      return;
    }
    const today = getTodayMexicoCity();
    const { error: insErr } = await supabase.from("well_daily_reviews").insert({
      pozo_id: pozoId,
      sampling_point_id: point.id,
      review_date: today,
      chlorine_residual: value,
      photo_url: photoUrl,
      sample_time: new Date().toISOString(),
      signed_by: userId,
    });
    if (insErr) {
      setError(insErr.message);
      setSaving(false);
      return;
    }
    await supabase
      .from("pozos")
      .update({ last_chlorine_residual: value })
      .eq("id", pozoId);
    setSaving(false);
    onSaved();
  };

  if (existing) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-800 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-600" />
              {point.address}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              <span className="font-bold">{existing.chlorine_residual}</span>{" "}
              mg/L · Hora:{" "}
              {existing.sample_time
                ? new Date(existing.sample_time).toLocaleTimeString("es-MX", {
                    timeZone: "America/Mexico_City",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "--"}
            </p>
            {signerName && (
              <p className="text-xs text-gray-500 mt-1">
                Firmado por: <span className="font-medium">{signerName}</span>
              </p>
            )}
          </div>
          <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <p className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-dtm-blue" />
        {point.address}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Cloro residual (mg/L)
          </label>
          <input
            type="number"
            step="any"
            inputMode="decimal"
            value={chlorine}
            onChange={(e) => setChlorine(e.target.value)}
            placeholder="0.00"
            className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
              exceeds
                ? "border-red-300 bg-red-50 focus:ring-red-400"
                : "border-gray-300 focus:ring-dtm-blue"
            }`}
          />
          {exceeds && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Excede {CHLORINE_UPPER_THRESHOLD} mg/L
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Foto evidencia
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            id={`file-${point.id}`}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt=""
                className="w-full h-20 object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label
              htmlFor={`file-${point.id}`}
              className="flex items-center justify-center gap-1 w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-dtm-blue hover:bg-blue-50 text-xs text-gray-500"
            >
              <Camera className="w-3.5 h-3.5" /> Adjuntar
            </label>
          )}
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-2 bg-red-50 px-3 py-1.5 rounded-lg">
          {error}
        </p>
      )}
      <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
        <Clock className="w-3 h-3" /> Al guardar se registra la hora actual.
        Firmará: <span className="font-medium">{userName || "tu usuario"}</span>
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-dtm-blue text-white py-2 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? "Guardando..." : "Guardar muestra"}
      </button>
    </div>
  );
}

function TankWeightSection({
  pozoId,
  tank,
  userId,
  onSaved,
}: {
  pozoId: string;
  tank: Tank;
  userId: string | null;
  onSaved: () => void;
}) {
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!weight) return;
    setSaving(true);
    const w = parseFloat(weight);
    await supabase.from("tanks").update({ current_weight_kg: w }).eq("id", tank.id);
    await supabase.from("tank_events").insert({
      tank_id: tank.id,
      event_type: "lectura_peso",
      pozo_id: pozoId,
      weight_kg: w,
      notes: "Lectura de revisión diaria",
    });
    void userId;
    setSaving(false);
    setDone(true);
    onSaved();
  };

  return (
    <div className="mt-6 border-t border-gray-100 pt-6">
      <h3 className="font-semibold text-gray-800 mb-2">
        Peso actual del tanque ({tank.identifier})
      </h3>
      {done ? (
        <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
          Peso actualizado.
        </p>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              step="any"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-dtm-blue"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
              KG
            </span>
          </div>
          <button
            type="button"
            disabled={saving || !weight}
            onClick={submit}
            className="bg-dtm-blue text-white px-4 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? "..." : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}

function HipocloritoSection({
  pozoId,
  sku,
  userId,
  onSaved,
}: {
  pozoId: string;
  sku: Hipoclorito | null;
  userId: string | null;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!sku) {
    return (
      <div className="mt-6 border-t border-gray-100 pt-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          No hay un SKU marcado como hipoclorito en inventario. Agrega o marca
          uno en Inventario para registrar rellenos.
        </div>
      </div>
    );
  }

  const submit = async () => {
    setError(null);
    const q = parseFloat(qty);
    if (!q || q <= 0) {
      setError("Ingresa una cantidad válida.");
      return;
    }
    if (q > Number(sku.current_qty)) {
      setError(
        `Existencia insuficiente (${sku.current_qty} kg disponibles).`
      );
      return;
    }
    setSaving(true);
    const { data: item } = await supabase
      .from("inventory_items")
      .select("price")
      .eq("id", sku.id)
      .single();
    const price = Number(item?.price || 0);
    const ins = await supabase.from("inventory_usages").insert({
      item_id: sku.id,
      qty: q,
      unit_price_snapshot: price,
      total_cost: price * q,
      source_type: "pozo",
      pozo_id: pozoId,
      description: "Relleno de hipoclorito en revisión diaria",
    });
    if (ins.error) {
      setError(ins.error.message);
      setSaving(false);
      return;
    }
    await supabase
      .from("inventory_items")
      .update({ current_qty: Number(sku.current_qty) - q })
      .eq("id", sku.id);
    void userId;
    setSaving(false);
    setDone(true);
    onSaved();
  };

  return (
    <div className="mt-6 border-t border-gray-100 pt-6">
      <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
        <Wrench className="w-4 h-4 text-amber-600" />
        Relleno de hipoclorito
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        Existencia actual: <span className="font-semibold">{sku.current_qty} kg</span>
      </p>
      {done ? (
        <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
          Relleno registrado y descontado del inventario.
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-dtm-blue"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                KG
              </span>
            </div>
            <button
              type="button"
              disabled={saving || !qty}
              onClick={submit}
              className="bg-amber-600 text-white px-4 rounded-lg font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? "..." : "Registrar"}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-600 mt-2 bg-red-50 px-3 py-1.5 rounded-lg">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
