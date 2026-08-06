import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getReportData } from "@/lib/reports/report-data";
import { ReportDocument } from "@/lib/reports/report-document";
import { checkRateLimit } from "@/lib/rate-limit/check";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Gerar PDF é a operação mais pesada exposta atrás de um simples GET —
  // 10/hora por projeto chega a qualquer uso legítimo.
  const { allowed } = await checkRateLimit(`report-pdf:${id}`, 10, 3600);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const data = await getReportData(id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const buffer = await renderToBuffer(<ReportDocument data={data} />);
  const filename = `basescope-${data.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
