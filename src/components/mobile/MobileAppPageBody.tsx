// @ts-nocheck
/* eslint-disable */
// MobileAppPage render body extracted verbatim (props-driven) to keep the page under 2k.
import { buildCheckInKeyForParticipantMatch, canEditChatMessage, chatSnippet, formatDate, formatDateTime, formatMonthLabel, formatTime, getMobileChatCutoffTs, isAudioAttachment, MobileAudioClip, normalizeChatClientId, nowDay, parseRoomIdFromQrPayload, shiftIsoDayByMonths } from './MobileAppPage.helpers';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Cog, Eraser, Globe, LogOut, MessageSquare, Mic, Moon, NotebookPen, Paperclip, Pencil, QrCode, RefreshCcw, Reply, ScanLine, Send, Smartphone, SmilePlus, Square, Star, Sun, Trash2, X } from 'lucide-react';
import ConfirmDialog from '../ui/ConfirmDialog';

export const MobileAppPageBody = (props: any) => {
  const { addReaction, agendaError, agendaLoading, agendaMonthDaysWithMeetings, agendaMonthLoading, agendaPayload, applyScannedRoomId, calendarActionButtonClass, calendarCardClass, calendarCells, calendarDayButtonBaseClass, calendarInputClass, calendarNavButtonClass, calendarWeekdayLabels, chatActionBusyId, chatAttachmentsBusy, chatBusy, chatClientId, chatClientLogoFailedById, chatClientOptions, chatDeletePrompt, chatEditingId, chatEditingText, chatError, chatFileInputRef, chatInput, chatInputRef, chatLastMessageByClientId, chatMessages, chatMessagesById, chatMessagesScrollRef, chatPendingAttachments, chatReactionForId, chatReplyTarget, chatSearch, chatUnreadByClientId, chatViewMode, checkedLabel, checkInInactiveLabel, checkInMapByMeetingId, checkInOkLabel, checkInPrefixLabel, checkInTsByMeetingId, clearCurrentChat, confirmChatDeleteMode, day, detectQrFromImageFile, directMessageLabel, displayMonth, doMobileCheckIn, emptyAgendaClass, filteredChatClientOptions, frameClass, getChatMessageAuthorName, getMeetingTemporalState, getMeetingTimePhaseBadgeLabel, handleChatFiles, handleMobileLanguageChange, handleMobileLogout, hydrateChatThreadFromCache, isDayTheme, lastAgendaSyncAt, lastAgendaSyncMs, linkedMissing, locale, meetingCheckInPrompt, meetingDetailOpen, meetingLabel, meetingMyNoteShared, meetingMyNoteText, meetingMyNoteTitle, meetingNotesDirty, meetingNotesError, meetingNotesList, meetingNotesLoading, meetingNotesOpen, meetingNotesParticipants, meetingNotesSaving, meetings, meetingsForSelectedRoom, meetingSharedNotePreview, mobileConfirm, mobileKeyboardInset, mutedTextClass, noMessagesLabel, notice, noticeClass, now, onSiteUpperLabel, openMeetingDetail, optionalShortLabel, pasteScannerLinkFromClipboard, reloadAgenda, reloadAgendaMonth, remoteShortLabel, removeChatMessage, requestCloseMeetingNotes, saveEditedChatMessage, saveMeetingSimpleNote, scannerDetecting, scannerError, scannerFileInputRef, scannerImageBusy, scannerManualValue, scannerOpen, scannerSupported, selectedChatClient, selectedChatClientAvatarUrl, selectedChatClientInitials, selectedChatClientLogoUrl, selectedChatClientName, selectedRoomId, sendMessage, setChatClientId, setChatClientLogoFailedById, setChatDeletePrompt, setChatEditingId, setChatEditingText, setChatError, setChatInput, setChatMessages, setChatPendingAttachments, setChatReactionForId, setChatReplyToId, setChatSearch, setChatViewMode, setDay, setMeetingCheckInPrompt, setMeetingDetailOpen, setMeetingMyNoteShared, setMeetingMyNoteText, setMeetingMyNoteTitle, setMeetingNotesOpen, setMeetingSharedNotePreview, setMobileConfirm, setMobileTheme, setScannerError, setScannerManualValue, setScannerOpen, setSelectedRoomId, setSettingsMenuOpen, settingsBusy, settingsMenuOpen, settingsMenuRef, shellClass, startEditChatMessage, startVoiceRecording, stopVoiceRecording, subtlePanelClass, syncBadge, tab, tabBtn, toggleStar, tr, user, videoRef, voiceRecordError, voiceRecording } = props;
  return (
          <div
        className={`h-[100dvh] overflow-hidden ${shellClass}`}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)'
        }}
      >
      <div className="mx-auto h-full max-w-3xl p-3 sm:p-4">
        <div className={`flex h-full flex-col overflow-hidden rounded-3xl border p-4 backdrop-blur ${frameClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`text-[11px] uppercase tracking-[0.18em] ${mutedTextClass}`}>Plixmap Mobile</div>
              <div className="truncate text-xl font-semibold">
                {user.firstName} {user.lastName}
              </div>
            </div>
            <div className="relative" ref={settingsMenuRef}>
              <button
                type="button"
                onClick={() => setSettingsMenuOpen((prev) => !prev)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${isDayTheme ? 'border-slate-200 bg-white text-slate-700' : 'border-white/10 bg-black/20 text-slate-200'}`}
                title={tr({ it: 'Impostazioni', en: 'Settings' })}
              >
                <Cog size={16} />
              </button>
              {settingsMenuOpen ? (
                <div className={`absolute right-0 top-12 z-20 w-64 rounded-2xl border p-3 shadow-2xl ${isDayTheme ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-slate-950 text-slate-100'}`}>
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${mutedTextClass}`}>{tr({ it: 'Impostazioni', en: 'Settings' })}</div>
                  <div className="mt-3">
                    <div className={`mb-1 flex items-center gap-2 text-xs font-semibold ${mutedTextClass}`}>
                      <Globe size={13} />
                      {tr({ it: 'Lingua', en: 'Language' })}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['it', 'en'] as const).map((lang) => {
                        const active = (user.language || 'it') === lang;
                        return (
                          <button
                            key={`mobile-lang-${lang}`}
                            type="button"
                            onClick={() => void handleMobileLanguageChange(lang)}
                            disabled={settingsBusy}
                            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                              active
                                ? isDayTheme
                                  ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                  : 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                                : isDayTheme
                                  ? 'border-slate-200 bg-slate-50 text-slate-700'
                                  : 'border-white/10 bg-black/20 text-slate-200'
                            }`}
                          >
                            {lang === 'it' ? 'Italiano' : 'English'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className={`mb-1 text-xs font-semibold ${mutedTextClass}`}>{tr({ it: 'Tema', en: 'Theme' })}</div>
                    <button
                      type="button"
                      onClick={() => setMobileTheme((prev) => (prev === 'night' ? 'day' : 'night'))}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold ${isDayTheme ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-white/10 bg-black/20 text-slate-200'}`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {isDayTheme ? <Moon size={15} /> : <Sun size={15} />}
                        {isDayTheme ? tr({ it: 'Passa a notte', en: 'Switch to night' }) : tr({ it: 'Passa a giorno', en: 'Switch to day' })}
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleMobileLogout()}
                    className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${isDayTheme ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-400/30 bg-rose-500/10 text-rose-200'}`}
                  >
                    <LogOut size={15} />
                    {tr({ it: 'Esci', en: 'Logout' })}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex gap-2">{[tabBtn('agenda', tr({ it: 'Agenda', en: 'Agenda' }), CalendarDays), tabBtn('chat', tr({ it: 'Chat', en: 'Chat' }), MessageSquare)]}</div>

          {tab !== 'chat' ? (
          <div className={`mt-4 rounded-2xl border p-3 ${subtlePanelClass}`}>
            <div className={`rounded-2xl border p-3 ${calendarCardClass}`}>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDay((prev) => shiftIsoDayByMonths(prev || nowDay(), -1))}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${calendarNavButtonClass}`}
                  title={tr({ it: 'Mese precedente', en: 'Previous month' })}
                >
                  <ChevronLeft size={15} />
                </button>
                <div className="min-w-0 text-center">
                  <div className={`truncate text-sm font-semibold capitalize ${isDayTheme ? 'text-slate-900' : 'text-slate-100'}`}>{formatMonthLabel(displayMonth, locale)}</div>
                  <div className={`mt-0.5 inline-flex items-center gap-1 text-[11px] ${mutedTextClass}`}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    {tr({ it: 'Giorni con meeting', en: 'Days with meetings' })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDay((prev) => shiftIsoDayByMonths(prev || nowDay(), 1))}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${calendarNavButtonClass}`}
                  title={tr({ it: 'Mese successivo', en: 'Next month' })}
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className={`mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] ${mutedTextClass}`}>
                {calendarWeekdayLabels.map((label, idx) => (
                  <div key={`mobile-calendar-weekday-${idx}`}>{label}</div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1">
                {calendarCells.map((cell, idx) => {
                  if (!cell) return <div key={`mobile-calendar-empty-${idx}`} className="h-10 rounded-xl border border-transparent" aria-hidden="true" />;
                  const meetingCount = Number(agendaMonthDaysWithMeetings[cell] || 0);
                  const hasMeeting = meetingCount > 0;
                  const selected = cell === day;
                  const today = cell === nowDay();
                  return (
                    <button
                      key={cell}
                      type="button"
                      onClick={() => setDay(cell)}
                      title={hasMeeting ? `${cell} • ${meetingCount} meeting` : cell}
                      className={`relative flex h-10 items-center justify-center rounded-xl border text-sm font-semibold transition ${
                        selected
                          ? isDayTheme
                            ? 'border-cyan-300 bg-cyan-50 text-cyan-700 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]'
                            : 'border-cyan-300/70 bg-cyan-500/20 text-cyan-50 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]'
                          : hasMeeting
                            ? isDayTheme
                              ? 'border-cyan-200 bg-cyan-50/60 text-slate-700'
                              : 'border-cyan-400/20 bg-cyan-500/5 text-slate-100'
                            : calendarDayButtonBaseClass
                      } ${today && !selected ? (isDayTheme ? 'ring-1 ring-inset ring-slate-300' : 'ring-1 ring-inset ring-white/20') : ''}`}
                    >
                      <span>{Number(cell.slice(8, 10))}</span>
                      {hasMeeting ? <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${selected ? (isDayTheme ? 'bg-cyan-600' : 'bg-cyan-100') : 'bg-cyan-300'}`} /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className={`text-xs font-semibold ${isDayTheme ? 'text-slate-600' : 'text-slate-300'}`}>{tr({ it: 'Data', en: 'Date' })}</label>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value || nowDay())}
                className={`rounded-lg border px-3 py-2 text-sm ${calendarInputClass}`}
              />
              <button
                type="button"
                onClick={() => {
                  void reloadAgenda();
                  void reloadAgendaMonth();
                }}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold ${calendarActionButtonClass}`}
                title={tr({ it: 'Aggiorna', en: 'Refresh' })}
              >
                <RefreshCcw size={14} className={agendaLoading || agendaMonthLoading ? 'animate-spin' : ''} />
              </button>
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  syncBadge.tone === 'ok'
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                    : syncBadge.tone === 'loading'
                      ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
                      : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                }`}
                title={
                  lastAgendaSyncAt
                    ? tr({ it: `Ultimo sync ${formatDateTime(lastAgendaSyncAt, locale)} • ${lastAgendaSyncMs}ms`, en: `Last sync ${formatDateTime(lastAgendaSyncAt, locale)} • ${lastAgendaSyncMs}ms` })
                    : tr({ it: 'Stato sincronizzazione', en: 'Sync status' })
                }
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    syncBadge.tone === 'ok'
                      ? 'bg-emerald-300'
                      : syncBadge.tone === 'loading'
                        ? 'bg-cyan-300 animate-pulse'
                        : 'bg-amber-300'
                  }`}
                />
                {syncBadge.label}
              </div>
              {tab === 'checkin' && selectedRoomId ? (
                <button
                  type="button"
                  onClick={() => setSelectedRoomId('')}
                  className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
                >
                  <QrCode size={13} />
                  {tr({ it: 'Sala', en: 'Room' })}: {selectedRoomId.slice(0, 8)}… ({tr({ it: 'rimuovi filtro', en: 'remove filter' })})
                </button>
              ) : null}
            </div>
          </div>
          ) : null}

          <div className={`mt-3 min-h-0 flex-1 overflow-x-hidden ${tab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto pr-1'}`}>
            {notice ? <div className={noticeClass}>{notice}</div> : null}
            {agendaLoading && !agendaPayload ? (
              <div className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                {tr({ it: 'Caricamento iniziale in corso. Potrebbero servire alcuni secondi per sincronizzare meeting e chat.', en: 'Initial loading in progress. It may take a few seconds to sync meetings and chat.' })}
              </div>
            ) : null}
            {agendaError && !linkedMissing ? <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{agendaError}</div> : null}
            {linkedMissing ? (
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                {tr({ it: 'L’utente del portale non è collegato a un utente reale importato. Chiedi a un admin di aprire ', en: 'The portal user is not linked to a real imported user. Ask an admin to open ' })}
                <b>Edit user</b>
                {tr({ it: ' e collegarti alla rubrica utenti del cliente.', en: ' and link you to the client user directory.' })}
              </div>
            ) : null}

          {tab === 'agenda' ? (
            <div className="mt-4 space-y-3">
              {!meetings.length && !agendaLoading ? (
                <div className={emptyAgendaClass}>{tr({ it: 'Nessun meeting per la giornata selezionata.', en: 'No meetings for the selected day.' })}</div>
              ) : null}
              {meetings.map((meeting) => {
                const { phase, inProgress, isPast } = getMeetingTemporalState(meeting.startAt, meeting.endAt, now);
                return (
                  <button
                    type="button"
                    key={meeting.id}
                    onClick={() => openMeetingDetail(meeting)}
                    className={`w-full rounded-2xl border p-3 text-left ${inProgress ? 'border-emerald-400/30 bg-emerald-500/10' : isPast ? 'border-white/10 bg-white/5 opacity-80' : 'border-violet-400/20 bg-violet-500/5'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{meeting.subject || meetingLabel}</div>
                        <div className="mt-1 text-xs text-slate-300">
                          {meeting.clientName} • {meeting.siteName} • {meeting.floorPlanName}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {meeting.roomName} • {formatDate(meeting.startAt, locale)} • {formatTime(meeting.startAt, locale)} - {formatTime(meeting.endAt, locale)}
                        </div>
                      </div>
                      <div className={`rounded-full px-2 py-1 text-[11px] font-bold ${inProgress ? 'bg-emerald-500/20 text-emerald-200' : isPast ? 'bg-slate-700/70 text-slate-300' : 'bg-violet-500/20 text-violet-200'}`}>
                        {getMeetingTimePhaseBadgeLabel(phase, tr)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {tab === 'chat' ? (
            <div className="mt-2 flex h-full min-h-0 flex-col">
              {chatViewMode === 'list' ? (
                <div className="flex min-h-0 flex-1 flex-col space-y-2">
                  <div className="mb-2 text-xs font-semibold text-slate-400">{tr({ it: 'Chat', en: 'Chat' })}</div>
                  <input
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                    placeholder={tr({ it: 'Cerca chat per cliente...', en: 'Search chats by client...' })}
                  />
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1">
                    {filteredChatClientOptions.map((c: any) => {
                      const normalizedId = normalizeChatClientId(c.id || '');
                      const unread = Number(chatUnreadByClientId[normalizedId] || 0);
                      const lastMsgRaw = chatLastMessageByClientId[normalizedId] || null;
                      const lastMsg = lastMsgRaw && Number(lastMsgRaw.createdAt || 0) >= getMobileChatCutoffTs() ? lastMsgRaw : null;
                      const logoUrl = !chatClientLogoFailedById[String(c.id)] ? String(c.logoUrl || c.avatarUrl || '') : '';
                      const parts = String(c.name || '')
                        .split(/\s+/)
                        .map((p) => p.trim())
                        .filter(Boolean);
                      const initials = !parts.length
                        ? 'CH'
                        : parts.length === 1
                          ? parts[0]!.slice(0, 2).toUpperCase()
                          : `${parts[0]![0] || ''}${parts[1]![0] || ''}`.toUpperCase();
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const nextId = normalizeChatClientId(c.id);
                            setChatClientId(nextId);
                            if (!hydrateChatThreadFromCache(nextId)) setChatMessages([]);
                            setChatReplyToId(null);
                            setChatEditingId(null);
                            setChatEditingText('');
                            setChatError('');
                            setChatViewMode('thread');
                          }}
                          className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-left text-slate-200"
                        >
                          <span className="flex min-w-0 items-start gap-2">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={c.name}
                                className={`mt-0.5 h-9 w-9 shrink-0 rounded-full border bg-white/5 object-cover ${
                                  unread > 0 ? 'border-emerald-300/60 ring-2 ring-emerald-400/30' : 'border-cyan-300/20'
                                }`}
                                onError={() =>
                                  setChatClientLogoFailedById((prev) => ({
                                    ...prev,
                                    [String(c.id)]: true
                                  }))
                                }
                              />
                            ) : (
                              <span
                                className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                                  unread > 0
                                    ? 'border-emerald-300/60 bg-emerald-500/10 text-emerald-100 ring-2 ring-emerald-400/30'
                                    : 'border-cyan-300/20 bg-cyan-500/10 text-cyan-100'
                                }`}
                              >
                                {initials}
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-100">{c.name}</span>
                              {c.kind === 'dm' ? <span className="block text-[10px] text-slate-500">{directMessageLabel}</span> : null}
                              <span className="mt-0.5 block truncate text-xs text-slate-400">{chatSnippet(lastMsg, tr) || noMessagesLabel}</span>
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            {lastMsg ? <span className="text-[10px] text-slate-400">{formatTime(Number(lastMsg.createdAt || 0), locale)}</span> : null}
                            {unread > 0 ? <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {!chatClientOptions.length ? <div className="text-sm text-slate-400">{tr({ it: 'Nessuna chat disponibile.', en: 'No chats available.' })}</div> : null}
                  {chatClientOptions.length > 0 && !filteredChatClientOptions.length ? <div className="text-xs text-slate-400">{tr({ it: 'Nessun risultato per la ricerca.', en: 'No results for this search.' })}</div> : null}
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/90 px-3 py-2 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setChatViewMode('list')}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-200"
                        title={tr({ it: 'Indietro', en: 'Back' })}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      {selectedChatClientLogoUrl || selectedChatClientAvatarUrl ? (
                        <img
                          src={selectedChatClientLogoUrl || selectedChatClientAvatarUrl}
                          alt={selectedChatClientName}
                          className="h-8 w-8 shrink-0 rounded-full border border-cyan-300/20 bg-white/5 object-cover"
                          onError={() =>
                            setChatClientLogoFailedById((prev) => ({
                              ...prev,
                              [String(selectedChatClient?.id || '')]: true
                            }))
                          }
                        />
                      ) : (
                        <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-500/10 text-xs font-bold text-cyan-100">
                          {selectedChatClientInitials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-100">{selectedChatClientName}</div>
                        <div className="flex items-center gap-1.5 truncate text-[11px] text-slate-400">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span>{chatBusy ? tr({ it: 'Sincronizzazione…', en: 'Syncing…' }) : tr({ it: 'Online', en: 'Online' })}</span>
                          <span className="text-slate-500">•</span>
                          <span>{chatMessages.length ? tr({ it: `${chatMessages.length} messaggi`, en: `${chatMessages.length} messages` }) : noMessagesLabel}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!chatClientId || chatBusy}
                        onClick={() => void clearCurrentChat()}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-semibold text-slate-200 disabled:opacity-50"
                        title={tr({ it: 'Svuota chat', en: 'Clear chat' })}
                      >
                        <Eraser size={12} />
                        {tr({ it: 'Svuota', en: 'Clear' })}
                      </button>
                    </div>
                  </div>

                  <div ref={chatMessagesScrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-y-contain p-3 pb-6">
                  {chatMessages.map((m) => {
                    const mine = String(m.userId || '') === String(user.id || '');
                    const replyTarget = m.replyToId ? chatMessagesById.get(String(m.replyToId)) : null;
                    const starred = Array.isArray(m.starredBy) && m.starredBy.includes(String(user.id || ''));
                    const reactionEntries = Object.entries((m.reactions && typeof m.reactions === 'object' ? m.reactions : {}) as Record<string, string[]>).filter(
                      ([, ids]) => Array.isArray(ids) && ids.length
                    );
                    return (
                      <div key={m.id} className={`rounded-xl border px-3 py-2 ${mine ? 'ml-8 border-cyan-400/20 bg-cyan-500/10' : 'mr-8 border-white/10 bg-white/5'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-xs font-semibold">{getChatMessageAuthorName(m)}</div>
                          <div className="flex items-center gap-2">
                            {starred ? <Star size={11} className="fill-amber-300 text-amber-300" /> : null}
                            <div className="text-[10px] text-slate-400">{formatDateTime(m.createdAt, locale)}</div>
                          </div>
                        </div>
                        {!m.deleted && replyTarget ? (
                          <div className="mt-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-300">
                            <div className="truncate font-semibold">{getChatMessageAuthorName(replyTarget)}</div>
                                  <div className="truncate text-slate-400">{String(replyTarget.text || '').trim() || ((replyTarget.attachments || []).length ? tr({ it: '[Allegato]', en: '[Attachment]' }) : tr({ it: '[Messaggio]', en: '[Message]' }))}</div>
                          </div>
                        ) : null}
                        {chatEditingId === m.id ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={chatEditingText}
                              onChange={(e) => setChatEditingText(e.target.value)}
                              rows={3}
                              className="w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-sm"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setChatEditingId(null);
                                  setChatEditingText('');
                                }}
                                className="rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold"
                              >
                                {tr({ it: 'Annulla', en: 'Cancel' })}
                              </button>
                              <button
                                type="button"
                                onClick={() => void saveEditedChatMessage()}
                                disabled={!String(chatEditingText || '').trim() || chatBusy}
                                className="rounded-lg bg-cyan-500 px-2 py-1 text-xs font-semibold text-slate-950 disabled:opacity-50"
                              >
                                {tr({ it: 'Salva', en: 'Save' })}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 whitespace-pre-wrap text-sm">{m.deleted ? tr({ it: '— messaggio eliminato —', en: '— message deleted —' }) : m.text}</div>
                        )}
                        {Array.isArray(m.attachments) && m.attachments.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {m.attachments.map((att, idx) => (
                              <div key={`${m.id}-att-${idx}`} className="max-w-full">
                                {String(att?.mime || '').startsWith('image/') ? (
                                  <a href={String(att?.url || '#')} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-white/10 bg-black/20">
                                    <img src={String(att?.url || '')} alt="" className="max-h-44 w-auto max-w-[220px] object-cover" />
                                  </a>
                                ) : null}
                                {isAudioAttachment(att?.mime, att?.name) ? (
                                  <MobileAudioClip
                                    src={String(att?.url || '')}
                                    mime={String(att?.mime || '') || undefined}
                                    name={String(att?.name || '') || undefined}
                                    className="h-8 max-w-[220px]"
                                  />
                                ) : !String(att?.mime || '').startsWith('image/') ? (
                                  <a
                                    href={String(att?.url || '#')}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-200"
                                    title={String(att?.name || tr({ it: 'Allegato', en: 'Attachment' }))}
                                  >
                                    <Paperclip size={11} />
                                    <span className="truncate">{String(att?.name || tr({ it: 'Allegato', en: 'Attachment' }))}</span>
                                  </a>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {reactionEntries.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {reactionEntries.map(([emoji, ids]) => (
                              <button
                                key={`${m.id}-${emoji}`}
                                type="button"
                                onClick={() => void addReaction(m.id, emoji)}
                                className={`rounded-full border px-2 py-0.5 text-[11px] ${ids.includes(String(user.id || '')) ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-white/10 bg-black/20 text-slate-200'}`}
                              >
                                {emoji} {ids.length}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {!m.deleted ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <button type="button" onClick={() => setChatReplyToId(m.id)} className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200">
                              <Reply size={11} className="inline mr-1" />
                              {tr({ it: 'Rispondi', en: 'Reply' })}
                            </button>
                            <button
                              type="button"
                              disabled={chatActionBusyId === m.id}
                              onClick={() => void toggleStar(m)}
                              className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200 disabled:opacity-50"
                            >
                              <Star size={11} className={`inline mr-1 ${starred ? 'fill-amber-300 text-amber-300' : ''}`} />
                              {starred ? tr({ it: 'Rimuovi stella', en: 'Unstar' }) : tr({ it: 'Stella', en: 'Star' })}
                            </button>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setChatReactionForId((prev) => (prev === m.id ? null : m.id))}
                                className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200"
                              >
                                <SmilePlus size={11} className="inline mr-1" />
                                {tr({ it: 'Reagisci', en: 'React' })}
                              </button>
                              {chatReactionForId === m.id ? (
                                <div className="absolute left-0 top-8 z-10 flex gap-1 rounded-xl border border-white/10 bg-slate-950 p-1 shadow-xl">
                                  {['👍', '❤️', '😂', '👏', '✅', '🔥'].map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      disabled={chatActionBusyId === m.id}
                                      onClick={() => void addReaction(m.id, emoji)}
                                      className="rounded-lg px-1.5 py-1 text-base hover:bg-white/5 disabled:opacity-50"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            {mine && !m.deleted ? (
                              <>
                                {!!user?.id && canEditChatMessage(m, String(user.id)) ? (
                                  <button type="button" onClick={() => startEditChatMessage(m)} className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200">
                                    <Pencil size={11} className="inline mr-1" />
                                    {tr({ it: 'Modifica', en: 'Edit' })}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={chatActionBusyId === m.id}
                                  onClick={() => void removeChatMessage(m)}
                                  className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-200 disabled:opacity-50"
                                >
                                  <Trash2 size={11} className="inline mr-1" />
                                  {tr({ it: 'Elimina...', en: 'Delete...' })}
                                </button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {!chatMessages.length && !chatBusy ? <div className="text-sm text-slate-400">{tr({ it: 'Nessun messaggio.', en: 'No messages.' })}</div> : null}
                  </div>

                  <div
                    className="sticky bottom-0 border-t border-white/10 bg-slate-950/95 px-3 pt-2 pb-2 backdrop-blur"
                    style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 8px + ${mobileKeyboardInset}px)` }}
                  >
                    {chatError ? <div className="mb-2 rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{chatError}</div> : null}
                    {chatReplyTarget ? (
                      <div className="mb-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{tr({ it: 'Risposta a', en: 'Replying to' })} {getChatMessageAuthorName(chatReplyTarget)}</div>
                            <div className="truncate text-cyan-200/80">
                              {String(chatReplyTarget.text || '').trim() || ((chatReplyTarget.attachments || []).length ? tr({ it: '[Allegato]', en: '[Attachment]' }) : tr({ it: '[Messaggio]', en: '[Message]' }))}
                            </div>
                          </div>
                          <button type="button" onClick={() => setChatReplyToId(null)} className="rounded-md p-1 hover:bg-white/10">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {chatPendingAttachments.length ? (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {chatPendingAttachments.map((att, idx) => (
                          <div key={`pending-${idx}-${att.name}`} className="max-w-full">
                            {String(att?.mime || '').startsWith('image/') ? (
                              <img src={att.dataUrl} alt="" className="mb-1 max-h-24 max-w-[120px] rounded-lg border border-white/10 object-cover" />
                            ) : null}
                            {isAudioAttachment(att?.mime, att?.name) ? (
                              <MobileAudioClip src={att.dataUrl} mime={att.mime || undefined} name={att.name || undefined} className="mb-1 h-8 max-w-full" />
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setChatPendingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                              className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-200"
                              title={tr({ it: 'Rimuovi allegato', en: 'Remove attachment' })}
                            >
                              <Paperclip size={11} />
                              <span className="truncate">{att.name}</span>
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {chatAttachmentsBusy ? (
                      <div className="mb-2 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">
                        {tr({ it: 'Preparazione allegati: attendi qualche secondo...', en: 'Preparing attachments: please wait a few seconds...' })}
                      </div>
                    ) : null}
                    {voiceRecordError ? <div className="mb-2 rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{voiceRecordError}</div> : null}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => chatFileInputRef.current?.click()}
                        disabled={!chatClientId || chatBusy}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-200 disabled:opacity-50"
                        title={tr({ it: 'Allega file', en: 'Attach file' })}
                      >
                        <Paperclip size={14} />
                      </button>
                      <input
                        ref={chatFileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          void handleChatFiles(e.target.files);
                          e.currentTarget.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (voiceRecording) void stopVoiceRecording();
                          else void startVoiceRecording();
                        }}
                        disabled={!chatClientId || chatBusy}
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border disabled:opacity-50 ${
                          voiceRecording ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-white/10 bg-black/20 text-slate-200'
                        }`}
                        title={voiceRecording ? tr({ it: 'Ferma registrazione', en: 'Stop recording' }) : tr({ it: 'Registra messaggio vocale', en: 'Record voice message' })}
                      >
                        {voiceRecording ? <Square size={14} /> : <Mic size={14} />}
                      </button>
                      <input
                        ref={chatInputRef}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onFocus={() => {
                          window.setTimeout(() => {
                            const el = chatMessagesScrollRef.current;
                            if (el) el.scrollTop = el.scrollHeight;
                          }, 80);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void sendMessage();
                          }
                        }}
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm"
                        placeholder={chatClientId ? tr({ it: 'Scrivi un messaggio...', en: 'Write a message...' }) : tr({ it: 'Seleziona un client', en: 'Select a client' })}
                        disabled={!chatClientId || chatBusy}
                      />
                      <button
                        type="button"
                        onClick={() => void sendMessage()}
                        disabled={!chatClientId || (!chatInput.trim() && !chatPendingAttachments.length) || chatBusy}
                        className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                      >
                        <Send size={14} />
                        {tr({ it: 'Invia', en: 'Send' })}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {tab === 'checkin' ? (
            <div className="mt-4 space-y-3">
              {!meetingsForSelectedRoom.length && !agendaLoading ? (
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-5 text-sm text-slate-300">
                  {selectedRoomId
                    ? tr({ it: 'Nessun meeting trovato per la sala QR selezionata.', en: 'No meeting found for the selected QR room.' })
                    : tr({ it: 'Nessun meeting disponibile per il check-in nella giornata selezionata.', en: 'No meeting available for check-in on the selected day.' })}
                </div>
              ) : null}
              {meetingsForSelectedRoom.map((meeting) => {
                const p = (meeting as any).participantMatch || {};
                const key = buildCheckInKeyForParticipantMatch(meeting);
                const checked = !!((checkInMapByMeetingId[String(meeting.id)] || {})[key]);
                const checkedAt = (checkInTsByMeetingId[String(meeting.id)] || {})[key];
                const { inProgress, isPast } = getMeetingTemporalState(meeting.startAt, meeting.endAt, now);
                const roomMatched = !selectedRoomId || String(meeting.roomId) === String(selectedRoomId);
                const remote = !!p.remote;
                const toneClass = inProgress
                  ? 'border-emerald-400/30 bg-emerald-500/10'
                  : isPast
                    ? 'border-white/10 bg-white/5'
                    : 'border-violet-400/20 bg-violet-500/5';
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    key={`ci-${meeting.id}`}
                    onClick={() => openMeetingDetail(meeting)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openMeetingDetail(meeting);
                      }
                    }}
                    className={`w-full rounded-2xl border p-3 text-left ${roomMatched ? toneClass : `${toneClass} opacity-60`}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{meeting.subject || meetingLabel}</div>
                        <div className="mt-1 text-xs text-slate-300">
                          {meeting.roomName} • {meeting.siteName} • {meeting.floorPlanName}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {formatTime(meeting.startAt, locale)} - {formatTime(meeting.endAt, locale)} • {remote ? tr({ it: 'Partecipante remoto', en: 'Remote participant' }) : tr({ it: 'In sede', en: 'On-site' })}
                        </div>
                        {checkedAt ? <div className="mt-1 text-[11px] text-emerald-300">{checkInPrefixLabel}: {formatDateTime(checkedAt, locale)}</div> : null}
                      </div>
                      <div className={`rounded-full px-2 py-1 text-[11px] font-bold ${checked ? 'bg-emerald-500/20 text-emerald-200' : remote ? 'bg-indigo-500/20 text-indigo-200' : inProgress ? 'bg-cyan-500/20 text-cyan-200' : 'bg-slate-700/70 text-slate-300'}`}>
                        {checked
                          ? checkedLabel
                          : remote
                            ? remoteShortLabel
                            : inProgress
                              ? tr({ it: 'IN CORSO', en: 'IN PROGRESS' })
                              : tr({ it: 'NON ATTIVO', en: 'INACTIVE' })}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {!remote ? (
                        <button
                          type="button"
                          disabled={!inProgress}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void doMobileCheckIn(meeting, !checked);
                          }}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                            checked
                              ? 'border border-rose-400/30 bg-rose-500/10 text-rose-200'
                              : 'bg-emerald-500 px-3 py-2 text-slate-950'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          <CheckCircle2 size={15} />
                          {checked ? tr({ it: 'Rimuovi check-in', en: 'Remove check-in' }) : 'Check-in'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          </div>
        </div>
      </div>

      {scannerOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-4"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 16px)',
            paddingRight: 'calc(env(safe-area-inset-right, 0px) + 16px)'
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-semibold">{tr({ it: 'Scansiona QR kiosk', en: 'Scan kiosk QR' })}</div>
              <button type="button" onClick={() => setScannerOpen(false)} className="rounded-lg p-2 text-slate-300 hover:bg-white/5" title={tr({ it: 'Chiudi scanner', en: 'Close scanner' })}>
                <X size={16} />
              </button>
            </div>
            {scannerSupported ? (
              <>
                <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="h-64 w-full object-cover" />
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {tr({ it: 'Punta la fotocamera verso il QR code mostrato nel kiosk della sala.', en: 'Point the camera at the QR code shown on the room kiosk.' })}
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {tr({ it: 'Questo browser non supporta la scansione QR integrata. Usa ', en: 'This browser does not support built-in QR scanning. Use ' })}
                <b>{tr({ it: 'Apri foto / QR', en: 'Open photo / QR' })}</b>
                {tr({ it: ' per scattare o selezionare una foto del QR, oppure incolla il link del kiosk.', en: ' to take or select a QR photo, or paste the kiosk link.' })}
              </div>
            )}
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tr({ it: 'Fallback manuale', en: 'Manual fallback' })}</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void pasteScannerLinkFromClipboard()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 shadow-sm active:scale-[0.99]"
                >
                  <QrCode size={14} />
                  {tr({ it: 'Incolla link dagli appunti', en: 'Paste link from clipboard' })}
                </button>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 shadow-sm active:scale-[0.99]">
                  <ScanLine size={14} />
                  {scannerImageBusy ? tr({ it: 'Analizzo immagine…', en: 'Analyzing image…' }) : tr({ it: 'Apri foto / QR', en: 'Open photo / QR' })}
                  <input
                    ref={scannerFileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void detectQrFromImageFile(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              <input
                value={scannerManualValue}
                onChange={(e) => setScannerManualValue(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder={tr({ it: 'Incolla URL kiosk o QR payload', en: 'Paste kiosk URL or QR payload' })}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const rid = parseRoomIdFromQrPayload(scannerManualValue);
                    if (!rid) {
                      setScannerError(tr({ it: 'QR/link non valido', en: 'Invalid QR/link' }));
                      return;
                    }
                    applyScannedRoomId(rid);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950"
                >
                  <Smartphone size={14} />
                  {tr({ it: 'Usa link', en: 'Use link' })}
                </button>
                {scannerDetecting ? <span className="text-xs text-slate-400">{tr({ it: 'Camera attiva…', en: 'Camera active…' })}</span> : null}
              </div>
              <div className="text-[11px] leading-relaxed text-slate-500">
                {tr({ it: 'iPhone/Safari: se la scansione live non è disponibile, usa ', en: 'iPhone/Safari: if live scanning is unavailable, use ' })}
                <b>{tr({ it: 'Apri foto / QR', en: 'Open photo / QR' })}</b>
                {tr({ it: ' (puoi scattare direttamente) oppure incolla qui il link del kiosk.', en: ' (you can take a picture directly) or paste the kiosk link here.' })}
              </div>
              {scannerError ? <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">{scannerError}</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {meetingDetailOpen ? (
        <div
          className="fixed inset-0 z-[75] bg-slate-950/85"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMeetingDetailOpen(null);
          }}
        >
          <div
            className="h-full w-full overflow-y-auto bg-slate-900 p-4 shadow-2xl"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
              paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 12px)',
              paddingRight: 'calc(env(safe-area-inset-right, 0px) + 12px)'
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const meeting = meetingDetailOpen;
              const p = (meeting as any).participantMatch || {};
              const key = buildCheckInKeyForParticipantMatch(meeting);
              const checked = !!((checkInMapByMeetingId[String(meeting.id)] || {})[key]);
              const checkedAt = (checkInTsByMeetingId[String(meeting.id)] || {})[key];
              const remote = !!p.remote;
              const { phase, inProgress, isPast } = getMeetingTemporalState(meeting.startAt, meeting.endAt, now);
              const allParticipants = Array.isArray(meeting.participants) ? meeting.participants : [];
              const externalDetails = Array.isArray(meeting.externalGuestsDetails) ? meeting.externalGuestsDetails : [];
              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-tight">
                        <span>{meeting.subject || meetingLabel}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            remote
                              ? 'bg-indigo-500/20 text-indigo-200'
                              : checked
                                ? 'bg-emerald-500/20 text-emerald-200'
                                : inProgress
                                  ? 'bg-amber-500/20 text-amber-200'
                                  : 'bg-slate-700/60 text-slate-200'
                          }`}
                        >
                          {remote ? remoteShortLabel : checked ? checkInOkLabel : inProgress ? checkInPrefixLabel : checkInInactiveLabel}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {meeting.clientName} • {meeting.siteName} • {meeting.floorPlanName}
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        {meeting.roomName} • {formatDate(meeting.startAt, locale)} • {formatTime(meeting.startAt, locale)} - {formatTime(meeting.endAt, locale)}
                      </div>
                    </div>
                    <button type="button" onClick={() => setMeetingDetailOpen(null)} className="rounded-lg p-2 text-slate-300 hover:bg-white/5" title={tr({ it: 'Chiudi dettaglio riunione', en: 'Close meeting details' })}>
                      <X size={16} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-slate-400">{tr({ it: 'Stato', en: 'Status' })}</div>
                      <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${inProgress ? 'bg-emerald-500/20 text-emerald-200' : isPast ? 'bg-slate-700/70 text-slate-300' : 'bg-violet-500/20 text-violet-200'}`}>
                        {getMeetingTimePhaseBadgeLabel(phase, tr)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-slate-400">{tr({ it: 'Posti', en: 'Seats' })}</div>
                      <div className="mt-1 font-semibold text-slate-100">
                        {meeting.requestedSeats}/{meeting.roomCapacity}
                      </div>
                    </div>
                    <div className="col-span-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-slate-400">{tr({ it: 'La mia presenza', en: 'My attendance' })}</div>
                      <div className="mt-1 font-semibold text-slate-100">{String(p.fullName || '—')}</div>
                      <div className="text-[11px] text-slate-400">
                        {p.email || '—'} • {remote ? tr({ it: 'Remoto', en: 'Remote' }) : tr({ it: 'In sede', en: 'On-site' })} {p.optional ? `• ${tr({ it: 'Opzionale', en: 'Optional' })}` : ''}
                      </div>
                    </div>
                    <div className="col-span-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-slate-400">{tr({ it: 'Partecipanti', en: 'Participants' })}</div>
                      <div className="mt-2 max-h-40 space-y-1 overflow-auto pr-1">
                        {allParticipants.map((mp, idx) => (
                          <div key={`mp-${idx}-${String(mp.externalId || mp.fullName || '')}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-semibold text-slate-100">{String(mp.fullName || '—')}</div>
                              <div className="truncate text-[10px] text-slate-400">
                                {mp.kind === 'manual' ? (mp.company ? `${mp.company} • ` : '') + tr({ it: 'Ospite esterno', en: 'External guest' }) : tr({ it: 'Utente interno', en: 'Internal user' })}
                                {mp.email ? ` • ${mp.email}` : ''}
                              </div>
                            </div>
                            <div className="shrink-0 text-[10px] text-slate-300">
                              {mp.remote ? remoteShortLabel : onSiteUpperLabel}{mp.optional ? ` • ${optionalShortLabel}` : ''}
                            </div>
                          </div>
                        ))}
                        {externalDetails.length
                          ? externalDetails.map((g, idx) => (
                              <div key={`gd-${idx}-${String(g.name || '')}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                                <div className="min-w-0">
                                  <div className="truncate text-[12px] font-semibold text-slate-100">{String(g.name || '—')}</div>
                                  <div className="truncate text-[10px] text-slate-400">
                                    {(g as any).company ? `${String((g as any).company)} • ` : ''}{tr({ it: 'Ospite esterno', en: 'External guest' })}{g.email ? ` • ${g.email}` : ''}
                                  </div>
                                </div>
                                <div className="shrink-0 text-[10px] text-slate-300">{g.remote ? remoteShortLabel : onSiteUpperLabel}</div>
                              </div>
                            ))
                          : null}
                        {(!Array.isArray(meeting.participants) || !meeting.participants.length) ? <div className="text-[11px] text-slate-400">{tr({ it: 'Nessuna lista partecipanti', en: 'No participants list' })}</div> : null}
                      </div>
                    </div>
                    {meeting.videoConferenceLink ? (
                      <div className="col-span-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                        <div className="text-slate-400">{tr({ it: 'Link video', en: 'Video link' })}</div>
                        <a
                          href={meeting.videoConferenceLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block truncate text-[12px] font-semibold text-cyan-200 underline decoration-cyan-200/40"
                        >
                          {meeting.videoConferenceLink}
                        </a>
                      </div>
                    ) : null}
                    {checkedAt ? (
                      <div className="col-span-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">
                        {checkInPrefixLabel}: {formatDateTime(checkedAt, locale)}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setMeetingNotesOpen(meeting)}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100"
                    >
                      <NotebookPen size={15} />
                      {tr({ it: 'Note', en: 'Notes' })}
                    </button>
                    {!remote && inProgress ? (
                      <button
                        type="button"
                        onClick={() => void doMobileCheckIn(meeting, !checked)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                          checked ? 'border border-rose-400/30 bg-rose-500/10 text-rose-100' : 'bg-emerald-500 text-slate-950'
                        }`}
                      >
                        <CheckCircle2 size={15} />
                        {checked ? tr({ it: 'Rimuovi check-in', en: 'Remove check-in' }) : checkInPrefixLabel}
                      </button>
                    ) : null}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {meetingCheckInPrompt ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl">
            <div className="text-base font-semibold text-slate-100">{tr({ it: 'Vuoi fare check-in ora?', en: 'Do you want to check in now?' })}</div>
            <div className="mt-1 text-sm text-slate-300">
              {meetingCheckInPrompt.subject || meetingLabel} • {formatTime(meetingCheckInPrompt.startAt, locale)} - {formatTime(meetingCheckInPrompt.endAt, locale)}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = meetingCheckInPrompt;
                  setMeetingCheckInPrompt(null);
                  setMeetingDetailOpen(target);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200"
              >
                {tr({ it: 'Più tardi', en: 'Later' })}
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = meetingCheckInPrompt;
                  setMeetingCheckInPrompt(null);
                  void doMobileCheckIn(target, true);
                  setMeetingDetailOpen(target);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950"
              >
                <CheckCircle2 size={14} />
                Check-in
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {meetingNotesOpen ? (
        <div
          className="fixed inset-0 z-[86] flex items-end justify-center bg-slate-950/80 p-3 sm:items-center"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            requestCloseMeetingNotes();
          }}
        >
          <div className="flex h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-slate-100">{tr({ it: 'Note meeting', en: 'Meeting notes' })}</div>
                <div className="mt-1 truncate text-xs text-slate-400">
                  {meetingNotesOpen.subject || meetingLabel} • {meetingNotesOpen.roomName} • {formatDate(meetingNotesOpen.startAt, locale)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  requestCloseMeetingNotes();
                }}
                className="rounded-lg p-2 text-slate-300 hover:bg-white/5"
                title={tr({ it: 'Chiudi note', en: 'Close notes' })}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-slate-300">{tr({ it: 'Le mie note meeting', en: 'My meeting notes' })}</div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-slate-300">
                  {meetingMyNoteShared ? tr({ it: 'Condivisa', en: 'Shared' }) : tr({ it: 'Personale', en: 'Personal' })}
                </span>
              </div>
              <input
                value={meetingMyNoteTitle}
                onChange={(e) => setMeetingMyNoteTitle(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder={tr({ it: 'Titolo nota', en: 'Note title' })}
              />
              <textarea
                value={meetingMyNoteText}
                onChange={(e) => setMeetingMyNoteText(e.target.value)}
                rows={16}
                className="mt-2 min-h-0 w-full flex-1 resize-none rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder={tr({ it: 'Scrivi le tue note...', en: 'Write your notes...' })}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-[12px] text-slate-300">
                  <input type="checkbox" checked={meetingMyNoteShared} onChange={(e) => setMeetingMyNoteShared(e.target.checked)} />
                  {tr({ it: 'Condividi con i partecipanti al meeting', en: 'Share with meeting participants' })}
                </label>
                <button
                  type="button"
                  onClick={() => void saveMeetingSimpleNote()}
                  disabled={meetingNotesSaving || !meetingNotesDirty}
                  className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
                >
                  {meetingNotesSaving ? tr({ it: 'Salvataggio…', en: 'Saving…' }) : tr({ it: 'Salva nota', en: 'Save note' })}
                </button>
              </div>
              {meetingNotesError ? <div className="mt-2 rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">{meetingNotesError}</div> : null}
              {meetingNotesLoading ? <div className="mt-2 text-[11px] text-slate-400">{tr({ it: 'Caricamento note…', en: 'Loading notes…' })}</div> : null}
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-slate-300">{tr({ it: 'Note condivise', en: 'Shared notes' })}</div>
                  <div className="text-[11px] text-slate-500">{tr({ it: `${meetingNotesParticipants.filter((p) => p.hasShared).length} partecipanti hanno condiviso`, en: `${meetingNotesParticipants.filter((p) => p.hasShared).length} participants shared` })}</div>
                </div>
                <div className="mt-2 max-h-40 space-y-1 overflow-auto pr-1">
                  {meetingNotesList.filter((n) => n.shared && String(n.authorUserId || '') !== String(user?.id || '')).length ? (
                    meetingNotesList
                      .filter((n) => n.shared && String(n.authorUserId || '') !== String(user?.id || ''))
                      .map((n) => (
                        <button
                          key={`shared-note-${n.id}`}
                          type="button"
                          onClick={() => setMeetingSharedNotePreview(n)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-left hover:bg-white/10"
                        >
                          <div className="truncate text-[12px] font-semibold text-slate-100">
                            {String(n.authorDisplayName || n.authorUsername || '—')} - {String(n.title || tr({ it: 'Nota condivisa', en: 'Shared note' }))}
                          </div>
                          <div className="truncate text-[10px] text-slate-400">{formatDateTime(n.updatedAt, locale)}</div>
                        </button>
                      ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-2 py-2 text-[11px] text-slate-400">{tr({ it: 'Nessuna nota condivisa per questo meeting.', en: 'No shared notes for this meeting.' })}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {meetingSharedNotePreview ? (
        <div className="fixed inset-0 z-[87] flex items-center justify-center bg-slate-950/75 p-4" onClick={() => setMeetingSharedNotePreview(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-slate-100">{meetingSharedNotePreview.title || tr({ it: 'Nota condivisa', en: 'Shared note' })}</div>
                <div className="mt-1 truncate text-xs text-slate-400">
                  {meetingSharedNotePreview.authorDisplayName || meetingSharedNotePreview.authorUsername || '—'} • {formatDateTime(meetingSharedNotePreview.updatedAt, locale)}
                </div>
              </div>
              <button type="button" onClick={() => setMeetingSharedNotePreview(null)} className="rounded-lg p-2 text-slate-300 hover:bg-white/5">
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
              {String(meetingSharedNotePreview.contentText || '').trim() || '—'}
            </div>
          </div>
        </div>
      ) : null}
      {chatDeletePrompt ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setChatDeletePrompt(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold text-slate-100">{tr({ it: 'Elimina messaggio', en: 'Delete message' })}</div>
            <div className="mt-1 text-sm text-slate-300">
              {chatDeletePrompt.allowAll
                ? tr({ it: 'Scegli se vuoi eliminarlo solo per te o per tutti.', en: 'Choose if you want to delete it only for you or for everyone.' })
                : tr({ it: 'Elimina per tutti non è più disponibile dopo 30 minuti.', en: 'Delete for everyone is no longer available after 30 minutes.' })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => setChatDeletePrompt(null)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200">
                {tr({ it: 'Annulla', en: 'Cancel' })}
              </button>
              <button type="button" onClick={() => void confirmChatDeleteMode('me')} className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-200">
                {tr({ it: 'Elimina per me', en: 'Delete for me' })}
              </button>
              {chatDeletePrompt.allowAll ? (
                <button type="button" onClick={() => void confirmChatDeleteMode('all')} className="rounded-xl border border-rose-400/40 bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-200">
                  {tr({ it: 'Elimina per tutti', en: 'Delete for everyone' })}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={!!mobileConfirm}
        title={mobileConfirm?.title || tr({ it: 'Conferma', en: 'Confirm' })}
        description={mobileConfirm?.description}
        onCancel={() => setMobileConfirm(null)}
        onConfirm={() => {
          if (!mobileConfirm) return;
          void mobileConfirm.onConfirm();
        }}
        confirmLabel={mobileConfirm?.confirmLabel || tr({ it: 'Conferma', en: 'Confirm' })}
        cancelLabel={mobileConfirm?.cancelLabel || tr({ it: 'Annulla', en: 'Cancel' })}
        zIndexClass="z-[250]"
      />
    </div>
  );
};
