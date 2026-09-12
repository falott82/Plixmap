/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowLeft, CheckCircle2, Eye, HelpCircle, Mail, Plus, ShieldCheck, Users, Wrench, X } from 'lucide-react';
import { KIOSK_LANG_OPTIONS, requiredAsterisk } from './MeetingManagerModal.helpers';

type Translate = (msg: { it: string; en: string }) => string;
type Props = Record<string, any> & { t: Translate };

/**
 * Details-step form of the meeting manager (subject, times + buffers + timing
 * bar, on-site/remote headcounts, participants & admin summary, kiosk language,
 * video link, notes). Extracted from MeetingManagerModal.
 */
export const MeetingDetailsForm = (props: Props) => {
  const {
    addMeetingAdmin,
    applyBufferAfter,
    applyBufferBefore,
    availableMeetingAdminCandidates,
    bufferAfter,
    bufferBefore,
    currentUserId,
    meetingAdminCandidateId,
    setMeetingAdminCandidateId,
    meetingKioskLanguage,
    meetingNotes,
    nextMeetingSameDay,
    onsiteExternalGuestsCount,
    onsiteHeadcount,
    onsiteInternalParticipantCount,
    onsiteManualGuestCount,
    onsiteSelectedCount,
    optionalCount,
    participantsOverCapacity,
    remoteInternalParticipantCount,
    remoteManualGuestCount,
    remoteSelectedCount,
    removeMeetingAdmin,
    removeParticipant,
    roomCapacity,
    selectedCount,
    selectedMeetingAdmins,
    selectedParticipants,
    selectedRoom,
    selectedRoomSlotBlocked,
    sendEmail,
    setSendEmail,
    technicalSetup,
    setTechnicalSetup,
    technicalEmail,
    setTechnicalEmail,
    setMeetingKioskLanguage,
    setMeetingNotes,
    setParticipantsModalOpen,
    setStep,
    setSubject,
    setupNeighbors,
    setVideoConferenceLink,
    setRoomPreview,
    subject,
    timingBarSegments,
    videoConferenceLink,
    t
  } = props;
  return (
                  <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.05fr_1fr]">
                    <div className="space-y-3">
                      <div className="rounded-xl border border-slate-200 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setStep('browse')}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <ArrowLeft size={13} /> {t({ it: 'Cambia sala', en: 'Change room' })}
                          </button>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-ink">
                                {selectedRoom?.roomName || '-'}{' '}
                                <span className="font-normal text-slate-600">
                                  - {t({ it: 'Posti disponibili', en: 'Available seats' })}: {selectedRoom?.availableSeats ?? 0} -{' '}
                                  {Number.isFinite(Number(selectedRoom?.surfaceSqm)) && Number(selectedRoom?.surfaceSqm) > 0
                                    ? `${t({ it: 'Superficie', en: 'Surface' })} ${Number(selectedRoom?.surfaceSqm).toFixed(1)} mq`
                                    : t({ it: 'Superficie n.d.', en: 'Surface n/a' })}
                                </span>
                              </div>
                            </div>
                            {selectedRoom ? (
                              <button
                                type="button"
                                onClick={() => setRoomPreview({ roomId: selectedRoom.roomId, floorPlanId: selectedRoom.floorPlanId })}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                title={t({ it: 'Mostra planimetria', en: 'Show floor plan' })}
                              >
                                <Eye size={13} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <label className="mt-2 block text-sm font-semibold text-slate-700">
                          {t({ it: 'Oggetto meeting', en: 'Meeting subject' })}{requiredAsterisk}
                          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        </label>
                        <label className="mt-3 block text-sm font-semibold text-slate-700">
                          {t({ it: 'Video conference LINK', en: 'Video conference LINK' })}
                          <input
                            type="url"
                            value={videoConferenceLink}
                            onChange={(e) => setVideoConferenceLink(e.target.value)}
                            placeholder={t({ it: 'Es. link Teams / Meet / Zoom', en: 'e.g. Teams / Meet / Zoom link' })}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="mt-3 block text-sm font-semibold text-slate-700">
                          {t({ it: 'Note', en: 'Notes' })}
                          <textarea
                            value={meetingNotes}
                            onChange={(e) => setMeetingNotes(e.target.value)}
                            rows={3}
                            placeholder={t({ it: 'Note aggiuntive per il meeting', en: 'Additional meeting notes' })}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        </label>
                        {participantsOverCapacity ? (
                          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                            {t({
                              it: `Warning: persone in presenza (${onsiteSelectedCount + onsiteExternalGuestsCount}) superiori alla capienza sala (${roomCapacity}). Puoi comunque creare il meeting.`,
                              en: `Warning: on-site attendees (${onsiteSelectedCount + onsiteExternalGuestsCount}) exceed room capacity (${roomCapacity}). You can still create the meeting.`
                            })}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-xl border border-slate-200 p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <Users size={15} />
                            {t({ it: 'Partecipanti', en: 'Participants' })}
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${participantsOverCapacity ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {selectedCount}/{roomCapacity}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">
                              {t({ it: `${optionalCount} facoltativi`, en: `${optionalCount} optional` })}
                            </span>
                            <button
                              type="button"
                              onClick={() => setParticipantsModalOpen(true)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Users size={13} />
                              {t({ it: 'Gestisci partecipanti', en: 'Manage participants' })}
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {t({
                            it: `${selectedCount} partecipanti interni (${optionalCount} facoltativi, ${remoteSelectedCount} remoti). Apri la modale per selezionare utenti reali e altri ospiti.`,
                            en: `${selectedCount} internal participants (${optionalCount} optional, ${remoteSelectedCount} remote). Open the modal to pick real users and other guests.`
                          })}
                        </div>
                        <div className="mt-2 flex max-h-24 flex-wrap gap-2 overflow-auto rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
                          {selectedParticipants.length ? (
                            selectedParticipants.map((row: any) => (
                              <span
                                key={row.key}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                                  row.kind === 'manual'
                                    ? 'border-violet-200 bg-violet-50 text-violet-800'
                                    : 'border-slate-200 bg-white text-slate-700'
                                }`}
                                >
                                  <span className="max-w-[220px] truncate uppercase tracking-[0.02em]">{row.fullName}</span>
                                  {row.optional ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">OPT</span> : null}
                                  {row.remote ? <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">REM</span> : null}
                                  <button
                                    type="button"
                                    onClick={() => removeParticipant(row.key)}
                                    className={row.kind === 'manual' ? 'text-violet-600 hover:text-rose-600' : 'text-slate-500 hover:text-rose-600'}
                                    title={row.kind === 'manual' ? t({ it: 'Rimuovi ospite', en: 'Remove guest' }) : t({ it: 'Rimuovi partecipante', en: 'Remove participant' })}
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500">{t({ it: 'Nessun partecipante selezionato.', en: 'No participant selected.' })}</span>
                            )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <ShieldCheck size={15} />
                            {t({ it: 'Admin meeting', en: 'Meeting admins' })}
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">
                              {selectedMeetingAdmins.length}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {t({
                            it: 'Uno o più utenti possono amministrare il meeting (modifica, estensione, cancellazione, gestione partecipanti).',
                            en: 'One or more users can administer the meeting (edit, extend, cancel, participant management).'
                          })}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
                          {selectedMeetingAdmins.length ? (
                            selectedMeetingAdmins.map((row: any) => {
                              const rowId = String(row.id || '');
                              const displayName =
                                `${String(row.firstName || '').trim()} ${String(row.lastName || '').trim()}`.trim() || row.username;
                              const fixed = rowId === currentUserId;
                              return (
                                <span
                                  key={`meeting-admin-${rowId}`}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                                    fixed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'
                                  }`}
                                  title={
                                    fixed
                                      ? t({ it: 'Creatore meeting (sempre admin)', en: 'Meeting creator (always admin)' })
                                      : t({ it: 'Admin meeting', en: 'Meeting admin' })
                                  }
                                >
                                  <span className="max-w-[220px] truncate">{displayName}</span>
                                  {fixed ? (
                                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                      {t({ it: 'Creatore', en: 'Creator' })}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => removeMeetingAdmin(rowId)}
                                      className="text-slate-500 hover:text-rose-600"
                                      title={t({ it: 'Rimuovi admin meeting', en: 'Remove meeting admin' })}
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-500">{t({ it: 'Nessun admin meeting selezionato.', en: 'No meeting admins selected.' })}</span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            value={meetingAdminCandidateId}
                            onChange={(e) => setMeetingAdminCandidateId(e.target.value)}
                            className="min-w-[260px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            disabled={!availableMeetingAdminCandidates.length}
                          >
                            {availableMeetingAdminCandidates.length ? (
                              availableMeetingAdminCandidates.map((row: any) => {
                                const label =
                                  `${String(row.firstName || '').trim()} ${String(row.lastName || '').trim()}`.trim() || row.username;
                                return (
                                  <option key={`meeting-admin-candidate-${row.id}`} value={row.id}>
                                    {label}
                                  </option>
                                );
                              })
                            ) : (
                              <option value="">{t({ it: 'Nessun altro utente disponibile', en: 'No additional user available' })}</option>
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => addMeetingAdmin(meetingAdminCandidateId)}
                            disabled={!meetingAdminCandidateId}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Plus size={13} />
                            {t({ it: 'Aggiungi admin', en: 'Add admin' })}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl border border-slate-200 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-ink">{t({ it: 'Setup e notifiche', en: 'Setup and notifications' })}</div>
                          <span className="group relative inline-flex items-center">
                            <HelpCircle size={14} className="text-slate-400" />
                            <span className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-80 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-normal text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                              {t({
                                it: 'Setup pre/post riunione: tempo operativo per preparazione sala, pulizie e ripristino dotazioni prima/dopo il meeting.',
                                en: 'Pre/post meeting setup: operational time to prepare room, clean up and restore equipment before/after the meeting.'
                              })}
                            </span>
                          </span>
                        </div>
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {t({ it: 'Timeline effettiva (pre / meeting / post)', en: 'Effective timeline (pre / meeting / post)' })}
                          </div>
                          <div className="flex h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-white">
                            <div
                              className="bg-amber-300"
                              style={{ width: `${timingBarSegments.prePct}%`, minWidth: timingBarSegments.preMin > 0 ? 4 : 0 }}
                              title={t({ it: `Pre-riunione: ${timingBarSegments.preMin} min`, en: `Pre-meeting: ${timingBarSegments.preMin} min` })}
                            />
                            <div
                              className="bg-emerald-400"
                              style={{ width: `${timingBarSegments.meetingPct}%`, minWidth: timingBarSegments.meetingMin > 0 ? 6 : 0 }}
                              title={t({ it: `Riunione: ${timingBarSegments.meetingMin} min`, en: `Meeting: ${timingBarSegments.meetingMin} min` })}
                            />
                            <div
                              className="bg-sky-300"
                              style={{ width: `${timingBarSegments.postPct}%`, minWidth: timingBarSegments.postMin > 0 ? 4 : 0 }}
                              title={t({ it: `Post-riunione: ${timingBarSegments.postMin} min`, en: `Post-meeting: ${timingBarSegments.postMin} min` })}
                            />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                            <span>{t({ it: `Pre ${timingBarSegments.preMin}m`, en: `Pre ${timingBarSegments.preMin}m` })}</span>
                            <span>{t({ it: `Meeting ${timingBarSegments.meetingMin}m`, en: `Meeting ${timingBarSegments.meetingMin}m` })}</span>
                            <span>{t({ it: `Post ${timingBarSegments.postMin}m`, en: `Post ${timingBarSegments.postMin}m` })}</span>
                          </div>
                        </div>
                        <label className="text-xs font-semibold text-slate-600">
                          {t({ it: 'Setup pre-riunione (min)', en: 'Pre-meeting setup (min)' })}: {bufferBefore}
                          <input type="range" min={0} max={setupNeighbors.maxBefore} value={bufferBefore} onChange={(e) => applyBufferBefore(Number(e.target.value) || 0)} className="mt-2 w-full" />
                          <div className="mt-1 text-[11px] text-slate-500">
                            {setupNeighbors.prev
                              ? t({
                                  it: `Max ${setupNeighbors.maxBefore} min (considerando meeting precedente ${new Date(setupNeighbors.prev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(setupNeighbors.prev.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
                                  en: `Max ${setupNeighbors.maxBefore} min (considering previous meeting ${new Date(setupNeighbors.prev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(setupNeighbors.prev.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                                })
                              : t({ it: 'Nessun meeting precedente: max 60 min.', en: 'No previous meeting: max 60 min.' })}
                          </div>
                        </label>
                        <label className="mt-2 block text-xs font-semibold text-slate-600">
                          {t({ it: 'Setup post-riunione (min)', en: 'Post-meeting setup (min)' })}: {bufferAfter}
                          <input type="range" min={0} max={setupNeighbors.maxAfter} value={bufferAfter} onChange={(e) => applyBufferAfter(Number(e.target.value) || 0)} className="mt-2 w-full" />
                          <div className="mt-1 text-[11px] text-slate-500">
                            {setupNeighbors.next
                              ? t({
                                  it: `Max ${setupNeighbors.maxAfter} min (prima del meeting successivo ${new Date(setupNeighbors.next.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(setupNeighbors.next.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
                                  en: `Max ${setupNeighbors.maxAfter} min (before next meeting ${new Date(setupNeighbors.next.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(setupNeighbors.next.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                                })
                              : t({ it: 'Nessun meeting successivo: max 60 min.', en: 'No next meeting: max 60 min.' })}
                          </div>
                        </label>
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            <span>{t({ it: 'Lingua kiosk meeting', en: 'Meeting kiosk language' })}</span>
                            <span className="group relative inline-flex items-center">
                              <HelpCircle size={13} className="text-slate-400" />
                              <span className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-80 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-normal text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                                {t({
                                  it: 'Auto usa la lingua del kiosk (impostazione manuale o lingua del dispositivo). Se imposti una lingua qui, quando il meeting inizia il kiosk passa automaticamente a quella lingua finché la riunione è in corso.',
                                  en: 'Auto uses the kiosk default language (manual choice or device language). If you set a language here, the kiosk automatically switches to that language while the meeting is in progress.'
                                })}
                              </span>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {KIOSK_LANG_OPTIONS.map((opt: any) => {
                              const active = meetingKioskLanguage === opt.key;
                              return (
                                <button
                                  key={`meeting-kiosk-lang-${opt.key}`}
                                  type="button"
                                  onClick={() => setMeetingKioskLanguage(opt.key)}
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${
                                    active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                  title={`${opt.flag} ${t(opt.labels)}`}
                                >
                                  <span>{opt.flag}</span>
                                  <span>{opt.key === 'auto' ? t({ it: 'Auto', en: 'Auto' }) : opt.key.toUpperCase()}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} /> <Mail size={15} />
                            {t({ it: 'Invia mail ai partecipanti', en: 'Send email to participants' })}
                          </label>
                          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <input type="checkbox" checked={technicalSetup} onChange={(e) => setTechnicalSetup(e.target.checked)} /> <Wrench size={15} />
                            {t({ it: 'Richiede setup tecnico', en: 'Technical setup required' })}
                          </label>
                          {technicalSetup ? (
                            <input
                              value={technicalEmail}
                              onChange={(e) => setTechnicalEmail(e.target.value)}
                              placeholder={t({ it: 'Email tecnico da notificare', en: 'Technician email to notify' })}
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                            />
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                          <span>{t({ it: 'Disponibilità', en: 'Availability' })}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${participantsOverCapacity ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {onsiteHeadcount}/{roomCapacity}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {t({
                            it: `${onsiteInternalParticipantCount} interni in sede (${optionalCount} facoltativi) · ${remoteInternalParticipantCount} interni remoti · ${onsiteManualGuestCount} altri ospiti in sede · ${remoteManualGuestCount} altri ospiti remoti. La disponibilità si aggiorna automaticamente.`,
                            en: `${onsiteInternalParticipantCount} on-site internal (${optionalCount} optional) · ${remoteInternalParticipantCount} remote internal · ${onsiteManualGuestCount} on-site guests · ${remoteManualGuestCount} remote guests. Availability updates automatically.`
                          })}
                        </div>
                        <div className={`mt-2 text-xs ${nextMeetingSameDay ? 'font-semibold text-blue-600' : 'text-slate-500'}`}>
                          {nextMeetingSameDay
                            ? t({
                                it: `Prossima riunione oggi: ${nextMeetingSameDay.subject || 'Meeting'} • ${new Date(nextMeetingSameDay.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(nextMeetingSameDay.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                                en: `Next meeting today: ${nextMeetingSameDay.subject || 'Meeting'} • ${new Date(nextMeetingSameDay.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-${new Date(nextMeetingSameDay.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              })
                            : t({ it: 'Nessun altro meeting previsto oggi per questa sala.', en: 'No more meetings today for this room.' })}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        <div className="flex items-center gap-2 font-semibold text-slate-700">
                          <CheckCircle2 size={14} className={selectedRoomSlotBlocked ? 'text-rose-600' : 'text-emerald-600'} />
                          {selectedRoomSlotBlocked
                            ? t({ it: 'Slot bloccato da meeting presenti o in approvazione.', en: 'Slot blocked by existing or pending meetings.' })
                            : t({ it: 'Nessuna sovrapposizione nello slot selezionato.', en: 'No overlaps in selected slot.' })}
                        </div>
                      </div>
                    </div>
                  </div>
  );
};
