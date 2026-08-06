import { NextResponse } from "next/server";
import { getReportData } from "@/lib/reports/report-data";
import { checkRateLimit } from "@/lib/rate-limit/check";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { allowed } = await checkRateLimit(`report-json:${id}`, 30, 3600);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const data = await getReportData(id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const filename = `basescope-${data.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
