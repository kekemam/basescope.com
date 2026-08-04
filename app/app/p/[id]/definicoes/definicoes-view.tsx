"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PanelTabs, PanelTabsContent, PanelTabsList, PanelTabsTrigger } from "@/components/ui/panel-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import { revokeCredentials, deleteProject, saveNotificationSettings, type NotificationSettingsInput } from "./actions";

interface Props {
  projectId: string;
  projectName: string;
  connectionStatus: string;
  verifiedDomain: string | null;
  notificationSettings: NotificationSettingsInput | null;
}

export function DefinicoesView({ projectId, projectName, connectionStatus, verifiedDomain, notificationSettings }: Props) {
  const router = useRouter();
  const [notif, setNotif] = useState<NotificationSettingsInput>(
    notificationSettings ?? { emailEnabled: true, slackWebhookUrl: "", discordWebhookUrl: "", notifyOn: "high_and_above" },
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  return (
    <div className="px-6 py-6 max-w-2xl">
      <PanelTabs defaultValue="credenciais">
        <PanelTabsList className="px-0">
          <PanelTabsTrigger value="credenciais">Credenciais</PanelTabsTrigger>
          <PanelTabsTrigger value="notificacoes">Notificações</PanelTabsTrigger>
          <PanelTabsTrigger value="agendamento">Agendamento</PanelTabsTrigger>
          <PanelTabsTrigger value="apagar">Apagar projeto</PanelTabsTrigger>
        </PanelTabsList>

        <PanelTabsContent value="credenciais" className="pt-4 flex flex-col gap-3">
          <p className="font-data text-data text-fg">Estado: {connectionStatus}</p>
          <p className="font-data text-data text-fg-muted">Domínio verificado: {verifiedDomain ?? "—"}</p>
          <p className="font-prosa text-body-sm text-fg-muted max-w-md">
            A service_role/connection string nunca é mostrada depois de guardada. Para trocar de credenciais, revoga
            estas e liga o projeto de novo.
          </p>
          <Button
            variant="danger"
            className="w-fit"
            onClick={async () => {
              await revokeCredentials(projectId);
              toast("Credenciais revogadas");
              router.refresh();
            }}
          >
            Revogar e apagar credenciais
          </Button>
        </PanelTabsContent>

        <PanelTabsContent value="notificacoes" className="pt-4 flex flex-col gap-4">
          <label className="flex items-center gap-2 font-data text-data text-fg">
            <Checkbox checked={notif.emailEnabled} onCheckedChange={(v) => setNotif((p) => ({ ...p, emailEnabled: !!v }))} />
            Alertas por email
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-data text-label uppercase tracking-[0.08em] text-fg-subtle">Slack webhook URL</span>
            <Input
              value={notif.slackWebhookUrl}
              onChange={(e) => setNotif((p) => ({ ...p, slackWebhookUrl: e.target.value }))}
              placeholder="https://hooks.slack.com/…"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-data text-label uppercase tracking-[0.08em] text-fg-subtle">Discord webhook URL</span>
            <Input
              value={notif.discordWebhookUrl}
              onChange={(e) => setNotif((p) => ({ ...p, discordWebhookUrl: e.target.value }))}
              placeholder="https://discord.com/api/webhooks/…"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-data text-label uppercase tracking-[0.08em] text-fg-subtle">Notificar em</span>
            <Select value={notif.notifyOn} onValueChange={(v) => setNotif((p) => ({ ...p, notifyOn: v as NotificationSettingsInput["notifyOn"] }))}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os achados</SelectItem>
                <SelectItem value="high_and_above">Alto e crítico</SelectItem>
                <SelectItem value="critical_only">Só crítico</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <Button
            variant="primary"
            className="w-fit"
            onClick={async () => {
              await saveNotificationSettings(projectId, notif);
              toast("Notificações guardadas");
            }}
          >
            Guardar
          </Button>
        </PanelTabsContent>

        <PanelTabsContent value="agendamento" className="pt-4">
          <p className="font-prosa text-body text-fg-muted">
            Scans agendados (pg_cron) ainda não estão disponíveis — Fase 4 do PROJECT_SPEC. Por agora, corre scans
            manualmente em Achados.
          </p>
        </PanelTabsContent>

        <PanelTabsContent value="apagar" className="pt-4">
          <p className="font-prosa text-body text-fg-muted mb-3">
            Apaga o projeto, os scans e os achados associados. Esta ação não tem volta atrás.
          </p>
          <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
            Apagar projeto
          </Button>

          <Dialog.Root open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 border border-border-str bg-overlay rounded-md shadow-lg p-4">
                <Dialog.Title className="font-data text-data text-fg mb-2">Apagar {projectName}?</Dialog.Title>
                <Dialog.Description className="font-prosa text-body-sm text-fg-muted mb-3">
                  Escreve o nome do projeto para confirmar.
                </Dialog.Description>
                <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={projectName} className="mb-3" />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
                    Cancelar
                  </Button>
                  <Button variant="danger" disabled={deleteConfirmText !== projectName} onClick={() => deleteProject(projectId)}>
                    Apagar definitivamente
                  </Button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </PanelTabsContent>
      </PanelTabs>
    </div>
  );
}
