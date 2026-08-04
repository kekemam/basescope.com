"use client";

import { useEffect, useState } from "react";
import { SeverityBar } from "@/components/severity-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { SidePanel, SidePanelBody, SidePanelFooter, SidePanelHeader } from "@/components/ui/side-panel";
import { PanelTabs, PanelTabsContent, PanelTabsList, PanelTabsTrigger } from "@/components/ui/panel-tabs";
import type { FindingViewModel } from "./types";
import { getFindingHistory, ignoreFindings, type FindingHistoryEntry } from "./actions";

export function FindingPanel({
  finding,
  onClose,
  onIgnored,
  mode,
}: {
  finding: FindingViewModel | null;
  onClose: () => void;
  onIgnored: (findingId: string) => void;
  mode: "plain" | "technical";
}) {
  const [history, setHistory] = useState<FindingHistoryEntry[] | null>(null);

  useEffect(() => {
    setHistory(null);
    if (finding) getFindingHistory(finding.id).then(setHistory);
    // Só o id identifica o achado para este efeito — o objeto finding muda de
    // referência a cada sort/filter sem o histórico precisar de recarregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finding?.id]);

  return (
    <SidePanel open={finding !== null} onOpenChange={(open) => !open && onClose()}>
      {finding && (
        <>
          <SidePanelHeader>
            <div className="flex items-center gap-3 min-w-0">
              <SeverityBar status={finding.severity} showLabel={false} />
              <span className="font-data text-data text-fg truncate">{finding.ruleId}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="h-6 w-6 flex items-center justify-center rounded-sm text-fg-muted hover:text-fg hover:bg-surface-2"
            >
              ✕
            </button>
          </SidePanelHeader>

          <p className="px-4 pt-3 font-data text-body-sm text-fg-muted truncate">{finding.resourceName}</p>

          <PanelTabs defaultValue="evidencia" className="flex flex-1 flex-col min-h-0">
            <PanelTabsList className="mt-2">
              <PanelTabsTrigger value="evidencia">Evidência</PanelTabsTrigger>
              <PanelTabsTrigger value="correcao">Correção</PanelTabsTrigger>
              <PanelTabsTrigger value="historico">Histórico</PanelTabsTrigger>
            </PanelTabsList>

            <SidePanelBody>
              <PanelTabsContent value="evidencia">
                {mode === "plain" ? (
                  <p className="font-prosa text-body text-fg">{finding.description}</p>
                ) : (
                  <pre className="font-data text-data text-fg whitespace-pre-wrap">
                    {JSON.stringify(finding.evidence, null, 2)}
                  </pre>
                )}
              </PanelTabsContent>

              <PanelTabsContent value="correcao" className="flex flex-col gap-3">
                {finding.remediationSql ? (
                  <CodeBlock code={finding.remediationSql} />
                ) : (
                  <p className="font-prosa text-body text-fg-muted">Sem SQL automático — segue os passos abaixo.</p>
                )}
                {finding.remediationSteps.length > 0 && (
                  <ol className="flex flex-col gap-2">
                    {finding.remediationSteps.map((step, i) => (
                      <li key={i} className="font-prosa text-body text-fg">
                        <span className="font-data text-body-sm text-fg-subtle mr-2">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                )}
              </PanelTabsContent>

              <PanelTabsContent value="historico">
                {history === null ? (
                  <p className="font-data text-body-sm text-fg-subtle">A carregar…</p>
                ) : history.length === 0 ? (
                  <p className="font-data text-body-sm text-fg-subtle">Sem histórico.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {history.map((entry, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Badge status={entry.status} />
                        <span className="font-data text-body-sm text-fg-muted">
                          {new Date(entry.changed_at).toLocaleString("pt-PT")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelTabsContent>
            </SidePanelBody>
          </PanelTabs>

          <SidePanelFooter>
            <Button
              variant="ghost"
              onClick={async () => {
                if (finding.remediationSql) await navigator.clipboard.writeText(finding.remediationSql);
              }}
              disabled={!finding.remediationSql}
            >
              Copiar SQL
            </Button>
            {finding.status === "open" && (
              <Button
                variant="ghost"
                onClick={async () => {
                  await ignoreFindings([finding.id], "Isto é público de propósito");
                  onIgnored(finding.id);
                }}
              >
                Ignorar
              </Button>
            )}
          </SidePanelFooter>
        </>
      )}
    </SidePanel>
  );
}
