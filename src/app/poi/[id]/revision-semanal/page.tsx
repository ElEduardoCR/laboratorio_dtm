"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { ArrowLeft, Construction } from "lucide-react";
import Link from "next/link";

export default function RevisionSemanal() {
  const params = useParams();
  const poiId = params?.id as string;
  const [poiName, setPoiName] = useState("");

  useEffect(() => {
    if (poiId) {
      supabase
        .from("poi")
        .select("name")
        .eq("id", poiId)
        .single()
        .then(({ data }) => {
          if (data) setPoiName(data.name);
        });
    }
  }, [poiId]);

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <Link
        href={`/poi/${poiId}`}
        className="inline-flex items-center text-dtm-blue hover:underline mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Regresar a {poiName}
      </Link>

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 text-center py-16">
        <Construction className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Revisión Semanal
        </h1>
        <p className="text-gray-500 max-w-sm mx-auto">
          Este formulario está en desarrollo. Próximamente podrás registrar las
          revisiones semanales de {poiName || "esta planta"}.
        </p>
      </div>
    </div>
  );
}
