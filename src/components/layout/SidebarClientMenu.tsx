import { type Dispatch, type SetStateAction } from 'react';
import { BarChart3, Building2, CalendarDays, ChevronRight, FileText, FolderOpen, Info, Mail, MessageCircle, Network, Paperclip, ShieldAlert, Trash, Users } from 'lucide-react';

type Translate = (msg: { it: string; en: string }) => string;

export type SidebarClientMenuProps = {
  clientMenu: any;
  setClientMenu: (value: null) => void;
  clients: any[];
  user: any;
  clientMenuRubricaOpen: boolean;
  setClientMenuRubricaOpen: Dispatch<SetStateAction<boolean>>;
  canChatClientIds: Set<string>;
  chatUnreadByClientId: any;
  canOpenBusinessPartnersDirectory: boolean;
  importSummaryByClient: any;
  findFirstPlanForClient: (...args: any[]) => any;
  setMissingPlansNotice: (...args: any[]) => any;
  openCapacityDashboard: (...args: any[]) => any;
  openClientMeetingsTimeline: (...args: any[]) => any;
  openClientChat: (...args: any[]) => any;
  setClientInfoId: (...args: any[]) => any;
  setClientAttachmentsId: (...args: any[]) => any;
  setClientIpMapId: (...args: any[]) => any;
  setClientNotesId: (...args: any[]) => any;
  setClientEmailSettingsId: (...args: any[]) => any;
  setClientEmergencyId: (...args: any[]) => any;
  setClientBusinessPartnersId: (...args: any[]) => any;
  setClientDirectoryId: (...args: any[]) => any;
  setConfirmDelete: (...args: any[]) => any;
  t: Translate;
};

/**
 * Client context menu (capacity dashboard, meetings, chat, info, attachments,
 * IP map, notes, SMTP, directories, delete). Extracted from SidebarTree.tsx.
 */
export const SidebarClientMenu = ({
  clientMenu,
  setClientMenu,
  clients,
  user,
  clientMenuRubricaOpen,
  setClientMenuRubricaOpen,
  canChatClientIds,
  chatUnreadByClientId,
  canOpenBusinessPartnersDirectory,
  importSummaryByClient,
  findFirstPlanForClient,
  setMissingPlansNotice,
  openCapacityDashboard,
  openClientMeetingsTimeline,
  openClientChat,
  setClientInfoId,
  setClientAttachmentsId,
  setClientIpMapId,
  setClientNotesId,
  setClientEmailSettingsId,
  setClientEmergencyId,
  setClientBusinessPartnersId,
  setClientDirectoryId,
  setConfirmDelete,
  t
}: SidebarClientMenuProps) => {
  if (!clientMenu) return null;
  return (
            <div
              className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
              style={{ top: clientMenu.y, left: clientMenu.x }}
            >
              <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">
                {t({ it: 'Cliente', en: 'Client' })}
              </div>
              <button
                onClick={() => {
                  const target = findFirstPlanForClient(clientMenu.clientId);
                  if (!target) {
                    const label = clients.find((c) => c.id === clientMenu.clientId)?.shortName || clients.find((c) => c.id === clientMenu.clientId)?.name || clientMenu.clientId;
                    setMissingPlansNotice({ clientName: label });
                    setClientMenu(null);
                    return;
                  }
                  openCapacityDashboard(target.planId, { clientId: clientMenu.clientId, siteId: target.siteId }, { keepCurrentPlan: true });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Apri dashboard capienza', en: 'Open capacity dashboard' })}
              >
                <BarChart3 size={14} className="text-slate-600" />
                {t({ it: 'Dashboard capienza', en: 'Capacity dashboard' })}
              </button>
              <button
                onClick={() => {
                  openClientMeetingsTimeline(clientMenu.clientId);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Mostra timeline meetings del cliente', en: 'Show client meetings timeline' })}
              >
                <CalendarDays size={14} className="text-slate-600" />
                {t({ it: 'Mostra meetings', en: 'Show meetings' })}
              </button>
              {canChatClientIds.has(clientMenu.clientId) ? (
                <button
                  onClick={() => {
                    openClientChat(clientMenu.clientId);
                    setClientMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  <MessageCircle size={14} className="text-slate-500" />
                  {t({ it: 'Chat', en: 'Chat' })}
                  {Number((chatUnreadByClientId as any)?.[clientMenu.clientId] || 0) > 0 ? (
                    <span className="ml-auto rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                      {Number((chatUnreadByClientId as any)?.[clientMenu.clientId] || 0) > 99
                        ? '99+'
                        : String(Number((chatUnreadByClientId as any)?.[clientMenu.clientId] || 0))}
                    </span>
                  ) : null}
                </button>
              ) : null}
              <button
                onClick={() => {
                  setClientInfoId(clientMenu.clientId);
                  setClientMenuRubricaOpen(false);
                  setClientMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <Info size={14} className="text-slate-500" />
                {t({ it: 'Info cliente', en: 'Client info' })}
              </button>
              <button
                onClick={() => {
                  setClientAttachmentsId(clientMenu.clientId);
                  setClientMenuRubricaOpen(false);
                  setClientMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Apri l’elenco allegati PDF del cliente', en: 'Open the client PDF attachments list' })}
              >
                <Paperclip size={14} className="text-slate-500" />
                {t({ it: 'Allegati', en: 'Attachments' })}
              </button>
              <button
                onClick={() => {
                  setClientIpMapId(clientMenu.clientId);
                  setClientMenuRubricaOpen(false);
                  setClientMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Apri la mappa IP del cliente', en: 'Open the client IP map' })}
              >
                <Network size={14} className="text-slate-500" />
                {t({ it: 'IP Map', en: 'IP Map' })}
              </button>
              <button
                onClick={() => {
                  setClientNotesId(clientMenu.clientId);
                  setClientMenuRubricaOpen(false);
                  setClientMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Aggiungi note formattate per questo cliente', en: 'Add formatted notes for this client' })}
              >
                <FileText size={14} className="text-slate-500" />
                {t({ it: 'Note cliente', en: 'Client notes' })}
              </button>
              <button
                onClick={() => {
                  setClientEmailSettingsId(clientMenu.clientId);
                  setClientMenuRubricaOpen(false);
                  setClientMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                title={t({ it: 'Configura SMTP per questo cliente', en: 'Configure SMTP for this client' })}
              >
                <Mail size={14} className="text-slate-500" />
                {t({ it: 'SMTP cliente', en: 'Client SMTP' })}
              </button>
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50">
                <button
                  onClick={() => setClientMenuRubricaOpen((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-100"
                  title={t({ it: 'Apri le rubriche del cliente', en: 'Open client directories' })}
                >
                  <FolderOpen size={14} className="text-slate-500" />
                  <span>{t({ it: 'Rubrica', en: 'Directory' })}</span>
                  <ChevronRight size={14} className={`ml-auto text-slate-500 transition-transform ${clientMenuRubricaOpen ? 'rotate-90' : ''}`} />
                </button>
                {clientMenuRubricaOpen ? (
                  <div className="border-t border-slate-200 px-1 py-1">
                    <button
                      onClick={() => {
                        setClientEmergencyId(clientMenu.clientId);
                        setClientMenuRubricaOpen(false);
                        setClientMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-white"
                      title={t({ it: 'Rubrica emergenze', en: 'Emergency directory' })}
                    >
                      <ShieldAlert size={14} className="text-rose-600" />
                      {t({ it: 'Emergenze', en: 'Emergencies' })}
                    </button>
                    {canOpenBusinessPartnersDirectory ? (
                      <button
                        onClick={() => {
                          setClientBusinessPartnersId(clientMenu.clientId);
                          setClientMenuRubricaOpen(false);
                          setClientMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-white"
                        title={t({ it: 'Rubrica Business Partner', en: 'Business partner directory' })}
                      >
                        <Building2 size={14} className="text-slate-600" />
                        {t({ it: 'Business partner', en: 'Business partners' })}
                      </button>
                    ) : null}
                    {importSummaryByClient[clientMenu.clientId]?.lastImportAt ? (
                      <button
                        onClick={() => {
                          setClientDirectoryId(clientMenu.clientId);
                          setClientMenuRubricaOpen(false);
                          setClientMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-white"
                        title={t({ it: 'Apri la rubrica utenti importati', en: 'Open the imported users directory' })}
                      >
                        <Users size={14} className="text-slate-500" />
                        {t({ it: 'Utenti', en: 'Users' })}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {user?.isAdmin ? (
                <button
                  onClick={() => {
                    const label = clients.find((c) => c.id === clientMenu.clientId)?.name || clientMenu.clientId;
                    setConfirmDelete({ kind: 'client', id: clientMenu.clientId, label });
                    setClientMenuRubricaOpen(false);
                    setClientMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-rose-700 hover:bg-rose-50"
                >
                  <Trash size={14} />
                  {t({ it: 'Elimina cliente', en: 'Delete client' })}
                </button>
              ) : null}
            </div>
  );
};
