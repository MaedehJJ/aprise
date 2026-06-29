"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, History } from "lucide-react";
import { GetToken, getSimilarJds, SimilarJD } from "@/lib/api";

export function SimilarRolesBanner({
  jdId,
  getToken,
}: {
  jdId: string;
  getToken: GetToken;
}) {
  const [similar, setSimilar] = useState<SimilarJD[]>([]);

  useEffect(() => {
    getSimilarJds(getToken, jdId)
      .then(setSimilar)
      .catch(() => {});
  }, [jdId, getToken]);

  if (similar.length === 0) return null;

  const companies = similar
    .filter((s) => s.company_name)
    .map((s) => s.company_name!)
    .join(", ");

  return (
    <div className="shrink-0 mx-4 mt-2 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <History className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-blue-800 font-medium">
            You&apos;ve worked similar roles
            {companies ? ` at ${companies}` : ""} — reuse stories from those sessions.
          </p>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {similar.map((s) =>
              s.conversation_id ? (
                <Link
                  key={s.jd_id}
                  href={`/app/roles/${s.conversation_id}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2"
                >
                  {s.company_name ?? "Unknown"} — {s.role_title ?? "Role"}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ) : (
                <span
                  key={s.jd_id}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-400 cursor-default"
                  title="No workspace for this role"
                >
                  {s.company_name ?? "Unknown"} — {s.role_title ?? "Role"}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
