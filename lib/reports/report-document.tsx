import "server-only";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ReportData } from "./report-data";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#CF333B",
  high: "#B85E09",
  medium: "#96700F",
  low: "#5B6674",
};

const SEVERITY_LABEL: Record<string, string> = { critical: "Crítico", high: "Elevado", medium: "Médio", low: "Baixo" };

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#14181C" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  brand: { fontSize: 16, fontWeight: 700 },
  meta: { fontSize: 9, color: "#57606B", marginTop: 2 },
  scoreBlock: { alignItems: "flex-end" },
  scoreValue: { fontSize: 28, fontWeight: 700 },
  scoreLabel: { fontSize: 8, color: "#57606B" },
  countsRow: { flexDirection: "row", gap: 16, marginBottom: 20, borderTop: "1px solid #E1E4E9", borderBottom: "1px solid #E1E4E9", paddingVertical: 10 },
  countCell: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  countText: { fontSize: 10 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 8, marginTop: 4 },
  finding: { marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #EEF0F3" },
  findingHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  badge: { fontSize: 8, fontWeight: 700, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2 },
  ruleId: { fontSize: 9, color: "#57606B" },
  findingTitle: { fontSize: 10.5, fontWeight: 700, marginBottom: 2 },
  resource: { fontSize: 9, color: "#57606B", marginBottom: 3, fontFamily: "Courier" },
  description: { fontSize: 9.5, lineHeight: 1.4, marginBottom: 4 },
  sql: { fontSize: 8.5, fontFamily: "Courier", backgroundColor: "#F5F6F8", padding: 6, borderRadius: 3 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#848D97", textAlign: "center" },
  empty: { fontSize: 10, color: "#57606B" },
});

/** Documento do "Export PDF" (PROJECT_SPEC § 7 — "para o utilizador mostrar ao cliente ou investidor"). Fundo branco, tipografia Helvetica embutida (sem fetch de fontes) — tem de renderizar de forma fiável em serverless. */
export function ReportDocument({ data }: { data: ReportData }) {
  return (
    <Document title={`Basescope · ${data.projectName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Basescope</Text>
            <Text style={styles.meta}>{data.projectName}</Text>
            <Text style={styles.meta}>Gerado em {new Date(data.generatedAt).toLocaleString("pt-PT")}</Text>
          </View>
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreValue}>{data.score}</Text>
            <Text style={styles.scoreLabel}>SCORE DE SEGURANÇA /100</Text>
          </View>
        </View>

        <View style={styles.countsRow}>
          {(["critical", "high", "medium", "low"] as const).map((sev) => (
            <View key={sev} style={styles.countCell}>
              <View style={[styles.dot, { backgroundColor: SEVERITY_COLOR[sev] }]} />
              <Text style={styles.countText}>
                {data.counts[sev]} {SEVERITY_LABEL[sev]}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Achados em aberto ({data.findings.length})</Text>

        {data.findings.length === 0 ? (
          <Text style={styles.empty}>Sem achados em aberto no último scan.</Text>
        ) : (
          data.findings.map((f, i) => (
            <View key={i} style={styles.finding} wrap={false}>
              <View style={styles.findingHeader}>
                <Text style={[styles.badge, { color: SEVERITY_COLOR[f.severity], backgroundColor: "#F5F6F8" }]}>
                  {SEVERITY_LABEL[f.severity]?.toUpperCase()}
                </Text>
                <Text style={styles.ruleId}>{f.ruleId}</Text>
              </View>
              <Text style={styles.findingTitle}>{f.title}</Text>
              <Text style={styles.resource}>{f.resourceName}</Text>
              <Text style={styles.description}>{f.description}</Text>
              {f.remediationSql && <Text style={styles.sql}>{f.remediationSql}</Text>}
            </View>
          ))
        )}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Basescope · basescope.com · página ${pageNumber} de ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
