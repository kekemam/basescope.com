import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getReportData } from "@/lib/reports/report-data";
import { ReportDocument } from "@/lib/reports/report-document";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
