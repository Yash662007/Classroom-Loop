import { NextResponse } from "next/server";
import { handleRoute, requireRole } from "@/lib/api";
import {
  getAdoptionDistribution,
  getImplementationMetrics,
  getTeachersNeedingIntervention,
  getTrainingToPracticeFunnel,
} from "@/lib/analytics";
import { buildReportCsv, buildReportSections } from "@/lib/reports";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports            → JSON sections for the printable page.
 * GET /api/admin/reports?format=csv → RFC 4180 CSV download of the same data.
 */
export async function GET(req: Request) {
  return handleRoute(async () => {
    await requireRole(req, "admin");

    const report = {
      generatedAt: new Date().toISOString(),
      sections: buildReportSections(
        getTrainingToPracticeFunnel(),
        getImplementationMetrics(),
        getAdoptionDistribution(),
        getTeachersNeedingIntervention()
      ),
    };

    if (new URL(req.url).searchParams.get("format") === "csv") {
      const date = report.generatedAt.slice(0, 10);
      return new NextResponse(buildReportCsv(report), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="classroom-loop-report-${date}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(report);
  });
}
