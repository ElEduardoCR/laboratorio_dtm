"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import {
  ArrowLeft,
  Cylinder,
  MapPin,
  Truck,
  PackageCheck,
  Ban,
  RefreshCw,
  Upload,
  X,
  History,
  FileText,
} from "lucide-react";

type Tank = {
  id: string;
  identifier: string;
  current_weight_kg: number;
  initial_weight_kg: number;
  status: "almacen" | "asignado" | "en_proveedor" | "baja";
  current_poi_id: string | null;
  current_pozo_id: string | null;
  decommission_certificate_url: string | null;
  decommissioned_at: string | null;
  notes: string | null;
  created_at: string;
};

type POI = { id: string; name: string };
type Pozo = { id: string; identifier: string; kind?: string | null };

type TankEvent = {
  id: string;
  event_type: string;
  poi_id: string | null;
  pozo_id: string | null;
  weight_kg: number | null;
  document_url: string | null;
  related_tank_id: string | null;
  notes: string | null;
  created_at: string;
  poi?: { name: string } | null;
  pozo?: { identifier: string } | null;
  related_tank?: { identifier: string } | null;
};

const STATUS_LABELS: Record<Tank["status"], { label: string; color: string }> =
  {
    almacen: { label: "En Almacén", color: "bg-gray-100 text-gray-700" },
    asignado: { label: "Asignado", color: "bg-green-100 text-green-700" },
    en_proveedor: {
      label: "En Proveedor",
      color: "bg-amber-100 text-amber-700",
    },
    baja: { label: "Dado de Baja", color: "bg-red-100 text-red-700" },
  };

const EVENT_LABELS: Record<string, string> = {
  compra: "Compra",
  asignacion: "Asignación",
  retiro: "Retiro a almacén",
  cambio_entrada: "Cambio (entrada)",
  cambio_salida: "Cambio (salida)",
  enviado_proveedor: "Enviado a proveedor",
  recibido_proveedor: "Recibido del proveedor",
  baja: "Dado de baja",
  lectura_peso: "Lectura de peso (revisión)",
};

type ActionMode = null | "asignar" | "retirar" | "baja";

export default function TanqueDetalle() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [tank, setTank] = useState<Tank | null>(null);
  const [currentPoi, setCurrentPoi] = useState<POI | null>(null);
  const [currentPozo, setCurrentPozo] = useState<Pozo | null>(null);
  const [pozos, setPozos] = useState<Pozo[]>([]);
  const [events, setEvents] = useState<TankEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<ActionMode>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  // Asignar (solo pozos urbanos)
  const [selectedDestId, setSelectedDestId] = useState("");
  const [destCurrentTank, setDestCurrentTank] = useState<{
    id: string;
    identifier: string;
  } | null>(null);

  // Baja
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPreview, setCertPreview] = useState("");
  const [bajaNotes, setBajaNotes] = useState("");
  const certInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (id) load();
  }, [id]);

  useEffect(() => {
    const checkDest = async () => {
      setDestCurrentTank(null);
      if (!selectedDestId) return;
      const { data } = await supabase
        .from("tanks")
        .select("id, identifier")
        .eq("current_pozo_id", selectedDestId)
        .eq("status", "asignado")
        .maybeSingle();
      if (data) setDestCurrentTank(data);
    };
    checkDest();
  }, [selectedDestId]);

  const load = async () => {
    setLoading(true);
    const { data: t } = await supabase
      .from("tanks")
      .select("*")
      .eq("id", id)
      .single();
    if (!t) {
      router.push("/tanques");
      return;
    }
    setTank(t as Tank);

    if (t.current_poi_id) {
      const { data: p } = await supabase
        .from("poi")
        .select("id, name")
        .eq("id", t.current_poi_id)
        .single();
      setCurrentPoi(p as POI);
    } else {
      setCurrentPoi(null);
    }

    if (t.current_pozo_id) {
      const { data: pz } = await supabase
        .from("pozos")
        .select("id, identifier")
        .eq("id", t.current_pozo_id)
        .single();
      setCurrentPozo(pz as Pozo);
    } else {
      setCurrentPozo(null);
    }

    const { data: pozoList } = await supabase
      .from("pozos")
      .select("id, identifier, kind")
      .eq("chlorination_type", "gas_cloro")
      .order("identifier");
    setPozos((pozoList as Pozo[]) || []);

    const { data: ev } = await supabase
      .from("tank_events")
      .select(
        "*, poi:poi_id(name), pozo:pozo_id(identifier), related_tank:related_tank_id(identifier)"
      )
      .eq("tank_id", id)
      .order("created_at", { ascending: false });
    setEvents((ev as TankEvent[]) || []);

    setLoading(false);
  };

  const resetActionState = () => {
    setMode(null);
    setActionError("");
    setSelectedDestId("");
    setDestCurrentTank(null);
    setCertFile(null);
    setCertPreview("");
    setBajaNotes("");
    if (certInputRef.current) certInputRef.current.value = "";
  };

  const uploadDocument = async (file: File, prefix: string) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `tanks/${id}/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("review-photos")
      .upload(path, file, {
        upsert: true,
        contentType: file.type || "application/octet-stream",
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

  // ---------- Acciones ----------
  const handleAsignar = async () => {
    if (!tank || saving) return;
    if (!selectedDestId) {
      setActionError("Selecciona un pozo.");
      return;
    }
    setSaving(true);
    setActionError("");

    const isSwap = !!destCurrentTank;

    if (isSwap && destCurrentTank) {
      await supabase
        .from("tanks")
        .update({ status: "almacen", current_poi_id: null, current_pozo_id: null })
        .eq("id", destCurrentTank.id);
      await supabase.from("tank_events").insert([
        {
          tank_id: destCurrentTank.id,
          event_type: "cambio_salida",
          pozo_id: selectedDestId,
          related_tank_id: tank.id,
        },
      ]);
    }

    await supabase
      .from("tanks")
      .update({
        status: "asignado",
        current_poi_id: null,
        current_pozo_id: selectedDestId,
      })
      .eq("id", tank.id);
    await supabase.from("tank_events").insert([
      {
        tank_id: tank.id,
        event_type: isSwap ? "cambio_entrada" : "asignacion",
        pozo_id: selectedDestId,
        related_tank_id: isSwap && destCurrentTank ? destCurrentTank.id : null,
      },
    ]);

    resetActionState();
    setSaving(false);
    load();
  };

  const handleRetirar = async () => {
    if (!tank || saving) return;
    setSaving(true);
    const previousPoiId = tank.current_poi_id;
    const previousPozoId = tank.current_pozo_id;
    await supabase
      .from("tanks")
      .update({ status: "almacen", current_poi_id: null, current_pozo_id: null })
      .eq("id", tank.id);
    await supabase.from("tank_events").insert([
      {
        tank_id: tank.id,
        event_type: "retiro",
        poi_id: previousPoiId,
        pozo_id: previousPozoId,
      },
    ]);
    resetActionState();
    setSaving(false);
    load();
  };

  const handleBaja = async () => {
    if (!tank || saving) return;
    if (!certFile) {
      setActionError("Adjunta el certificado del auditor.");
      return;
    }
    setSaving(true);
    setActionError("");
    const url = await uploadDocument(certFile, "certificado-baja");
    if (!url) {
      setActionError("No se pudo subir el certificado.");
      setSaving(false);
      return;
    }
    await supabase
      .from("tanks")
      .update({
        status: "baja",
        current_poi_id: null,
        current_pozo_id: null,
        decommission_certificate_url: url,
        decommissioned_at: new Date().toISOString(),
      })
      .eq("id", tank.id);
    await supabase.from("tank_events").insert([
      {
        tank_id: tank.id,
        event_type: "baja",
        document_url: url,
        notes: bajaNotes.trim() || null,
      },
    ]);
    resetActionState();
    setSaving(false);
    load();
  };

  if (loading || !tank) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dtm-blue"></div>
      </div>
    );
  }

  const pct =
    tank.initial_weight_kg > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round((tank.current_weight_kg / tank.initial_weight_kg) * 100)
          )
        )
      : 0;
  const lowFuel = pct <= 15 && tank.status === "asignado";

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <Link
        href="/tanques"
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a Tanques
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-3 rounded-xl">
              <Cylinder className="w-7 h-7 text-dtm-blue" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                {tank.identifier}
              </h1>
              {tank.status === "asignado" && (currentPoi || currentPozo) && (
                <p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  <span className="text-gray-400">
                    {currentPoi ? "Planta:" : "Pozo:"}
                  </span>{" "}
                  {currentPoi?.name || currentPozo?.identifier}
                </p>
              )}
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${STATUS_LABELS[tank.status].color}`}
          >
            {STATUS_LABELS[tank.status].label}
          </span>
        </div>

        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm text-gray-500 font-medium">
              Peso actual
            </span>
            <span className="text-2xl font-bold text-gray-800">
              {tank.current_weight_kg}{" "}
              <span className="text-sm font-normal text-gray-500">
                / {tank.initial_weight_kg} KG
              </span>
            </span>
          </div>
          <div className="w-full bg-white rounded-full h-3 overflow-hidden border border-gray-200">
            <div
              className={`h-3 ${
                lowFuel
                  ? "bg-red-500"
                  : pct <= 35
                    ? "bg-amber-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${pct}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">{pct}% restante</p>
        </div>

        {tank.notes && (
          <p className="text-sm text-gray-600 mt-4 bg-gray-50 p-3 rounded-lg">
            <span className="font-medium">Notas:</span> {tank.notes}
          </p>
        )}

        {tank.decommission_certificate_url && (
          <a
            href={tank.decommission_certificate_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100"
          >
            <FileText className="w-4 h-4" />
            Ver certificado de baja
          </a>
        )}
      </div>

      {/* Acciones */}
      {tank.status !== "baja" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Acciones</h2>

          <div className="flex flex-wrap gap-2 mb-4">
            {tank.status === "almacen" && (
              <button
                onClick={() => setMode(mode === "asignar" ? null : "asignar")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  mode === "asignar"
                    ? "bg-dtm-blue text-white"
                    : "bg-blue-50 text-dtm-blue hover:bg-blue-100"
                }`}
              >
                <MapPin className="w-4 h-4" /> Asignar a Pozo
              </button>
            )}
            {tank.status === "asignado" && (
              <button
                onClick={() => setMode(mode === "retirar" ? null : "retirar")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  mode === "retirar"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                <RefreshCw className="w-4 h-4" /> Retirar a Almacén
              </button>
            )}
            {tank.status === "en_proveedor" && (
              <Link
                href="/tanques/recibir-proveedor"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                <PackageCheck className="w-4 h-4" /> Recibir del Proveedor
              </Link>
            )}
            {tank.status === "almacen" && (
              <Link
                href="/tanques/enviar-proveedor"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Truck className="w-4 h-4" /> Enviar a Proveedor
              </Link>
            )}
            <button
              onClick={() => setMode(mode === "baja" ? null : "baja")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                mode === "baja"
                  ? "bg-red-600 text-white"
                  : "bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              <Ban className="w-4 h-4" /> Dar de Baja
            </button>
          </div>

          {/* Panel de acción */}
          {mode === "asignar" && (
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pozo destino (solo con tanque gas-cloro)
                </label>
                <select
                  value={selectedDestId}
                  onChange={(e) => setSelectedDestId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dtm-blue"
                >
                  <option value="">Selecciona un pozo...</option>
                  {pozos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.identifier}
                    </option>
                  ))}
                </select>
              </div>
              {destCurrentTank && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  Este pozo ya tiene asignado el tanque{" "}
                  <strong>{destCurrentTank.identifier}</strong>. Al continuar se
                  registrará un cambio: el tanque saliente regresará a almacén.
                </div>
              )}
              {actionError && (
                <p className="text-sm text-red-600">{actionError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={resetActionState}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAsignar}
                  disabled={saving || !selectedDestId}
                  className="flex-1 px-4 py-2 bg-dtm-blue text-white rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  {saving
                    ? "Guardando..."
                    : destCurrentTank
                      ? "Confirmar Cambio"
                      : "Asignar"}
                </button>
              </div>
            </div>
          )}

          {mode === "retirar" && (
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <p className="text-sm text-gray-600">
                Se retirará el tanque <strong>{tank.identifier}</strong> de{" "}
                <strong>
                  {currentPoi?.name || currentPozo?.identifier}
                </strong>{" "}
                y quedará en almacén.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={resetActionState}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRetirar}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Confirmar Retiro"}
                </button>
              </div>
            </div>
          )}

          {mode === "baja" && (
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                Al dar de baja, el tanque ya no podrá ser asignado a plantas ni
                enviado a proveedor. Se requiere el certificado del auditor.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certificado del auditor
                </label>
                <input
                  ref={certInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  id="cert-file"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setCertFile(f);
                    if (f && f.type.startsWith("image/")) {
                      setCertPreview(URL.createObjectURL(f));
                    } else {
                      setCertPreview("");
                    }
                  }}
                />
                {certFile ? (
                  <div className="relative border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                    {certPreview ? (
                      <img
                        src={certPreview}
                        alt=""
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <FileText className="w-10 h-10 text-gray-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {certFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(certFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCertFile(null);
                        setCertPreview("");
                        if (certInputRef.current)
                          certInputRef.current.value = "";
                      }}
                      className="text-red-500 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="cert-file"
                    className="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-red-400 hover:bg-red-50 text-sm text-gray-500"
                  >
                    <Upload className="w-4 h-4" />
                    Adjuntar certificado (PDF o imagen)
                  </label>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  rows={2}
                  value={bajaNotes}
                  onChange={(e) => setBajaNotes(e.target.value)}
                  placeholder="Motivo de la baja..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
              </div>
              {actionError && (
                <p className="text-sm text-red-600">{actionError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={resetActionState}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBaja}
                  disabled={saving || !certFile}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Confirmar Baja"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historial */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-dtm-blue" />
          Historial
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Sin movimientos registrados.
          </p>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <div
                key={e.id}
                className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition"
              >
                <div className="flex justify-between items-start gap-3 mb-1">
                  <p className="font-semibold text-gray-800 text-sm">
                    {EVENT_LABELS[e.event_type] || e.event_type}
                  </p>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(e.created_at).toLocaleString("es-MX", {
                      timeZone: "America/Mexico_City",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <div className="text-xs text-gray-600 space-y-0.5">
                  {e.poi?.name && (
                    <p>
                      <span className="text-gray-400">Planta:</span>{" "}
                      {e.poi.name}
                    </p>
                  )}
                  {e.pozo?.identifier && (
                    <p>
                      <span className="text-gray-400">Pozo:</span>{" "}
                      {e.pozo.identifier}
                    </p>
                  )}
                  {e.weight_kg !== null && (
                    <p>
                      <span className="text-gray-400">Peso:</span>{" "}
                      {e.weight_kg} KG
                    </p>
                  )}
                  {e.related_tank?.identifier && (
                    <p>
                      <span className="text-gray-400">Tanque relacionado:</span>{" "}
                      {e.related_tank.identifier}
                    </p>
                  )}
                  {e.notes && (
                    <p className="text-gray-700 mt-1 italic">{e.notes}</p>
                  )}
                  {e.document_url && (
                    <a
                      href={e.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-dtm-blue hover:underline mt-1"
                    >
                      <FileText className="w-3 h-3" />
                      Ver documento
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
