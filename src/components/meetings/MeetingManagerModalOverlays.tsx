import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AlertTriangle, Building2, HelpCircle, Minus, Plus, Search, Users, X } from 'lucide-react';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Participant-picker + earliest-suggestion overlays extracted verbatim from
// MeetingManagerModal to keep it under 2k lines. Render-only; deps arrive via props.

export const ParticipantsOverlay = (props: any) => {
  const {
    addEntireDepartment, addManualParticipant, businessPartnersModalOpen, canOpenBusinessPartnersDirectory,
    closeParticipantsModal, filteredParticipants, formatParticipantConflictLabel, manualCompany, manualCompanyIsOther,
    manualEmail, manualName, manualOptional, manualRemote, optionalCount, orderedFilteredParticipants, participantFilter,
    participantsFilterInputRef, participantsModalOpen, participantsOverCapacity, remoteSelectedCount, removeParticipant,
    roomCapacity, selectedClientBusinessPartners, selectedCount, selectedExternalIds, selectedParticipants,
    selectedParticipantsByExternalId, setBusinessPartnersModalOpen, setManualCompany, setManualCompanyIsOther,
    setManualEmail, setManualName, setManualOptional, setManualRemote, setParticipantFilter, t,
    toggleParticipantOptional, toggleParticipantRemote, upsertExternalParticipant, open
  } = props;
  return (
    <Transition show={participantsModalOpen && open} as={Fragment}>
      <div
        className="fixed inset-0 z-[92] pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label={t({ it: 'Seleziona partecipanti', en: 'Select participants' })}
      >
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div
            className="pointer-events-auto fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (businessPartnersModalOpen) return;
              closeParticipantsModal();
            }}
          />
        </Transition.Child>
        <div
          className="pointer-events-auto fixed inset-0 overflow-y-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <div
                className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">{t({ it: 'Seleziona partecipanti', en: 'Select participants' })}</h2>
                    <div className="text-xs text-slate-500">
                      {t({
                        it: 'Aggiungi utenti reali o partecipanti manuali. Premi OK per tornare alla configurazione meeting.',
                        en: 'Add real users or manual participants. Press OK to return to meeting configuration.'
                      })}
                    </div>
                  </div>
                  <button onClick={closeParticipantsModal} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Users size={15} />
                      {t({ it: 'Partecipanti', en: 'Participants' })}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${participantsOverCapacity ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {selectedCount}/{roomCapacity}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {t({ it: `${optionalCount} facoltativi • ${remoteSelectedCount} remoti`, en: `${optionalCount} optional • ${remoteSelectedCount} remote` })}
                    </span>
                  </div>
                  <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-500">
                    <HelpCircle size={13} className="text-slate-400" />
                    <span>
                      {t({
                        it: 'Colonne: nome, email, reparto, interno/cellulare. Tasto destro sul reparto per aggiungere tutto il reparto visibile nel filtro.',
                        en: 'Columns: name, email, department, extension/mobile. Right-click a department to add the whole department currently visible in the filter.'
                      })}
                    </span>
                  </div>
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                    <input
                      ref={participantsFilterInputRef}
                      value={participantFilter}
                      onChange={(e) => setParticipantFilter(e.target.value)}
                      placeholder={t({ it: 'Filtra utenti reali...', en: 'Filter real users...' })}
                      className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm"
                    />
                  </div>
                  <div className="mt-2 max-h-[34vh] space-y-1 overflow-auto rounded-lg border border-slate-200 p-2">
                    {orderedFilteredParticipants.allRows.map((row: any, index: number) => {
                      const selected = selectedExternalIds.has(row.externalId);
                      const selectedRow = selectedParticipantsByExternalId.get(row.externalId);
                      const conflictLabel = formatParticipantConflictLabel(String(row.externalId || ''));
                      const startsAvailableSection =
                        orderedFilteredParticipants.selectedRows.length > 0 && index === orderedFilteredParticipants.selectedRows.length;
                      return (
                        <Fragment key={row.key}>
                          {startsAvailableSection ? (
                            <div className="my-1 border-t border-dashed border-slate-300 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {t({ it: 'Disponibili', en: 'Available' })}
                            </div>
                          ) : null}
                          {index === 0 && orderedFilteredParticipants.selectedRows.length > 0 ? (
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                              {t({ it: 'Selezionati', en: 'Selected' })}
                            </div>
                          ) : null}
                          <div className="grid grid-cols-[auto,minmax(0,1.1fr),minmax(0,220px),minmax(0,180px),minmax(0,140px),auto] items-center gap-2 text-sm">
                            <button
                              type="button"
                              onClick={() => upsertExternalParticipant(row)}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                                selected
                                  ? 'border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200'
                                  : 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              }`}
                              title={selected ? t({ it: 'Rimuovi', en: 'Remove' }) : t({ it: 'Aggiungi', en: 'Add' })}
                            >
                              {selected ? <Minus size={13} /> : <Plus size={13} />}
                            </button>
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-slate-700">{row.fullName}</span>
                                {conflictLabel ? (
                                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                    <AlertTriangle size={11} />
                                    {t({ it: 'Occupato', en: 'Busy' })}
                                  </span>
                                ) : null}
                              </div>
                              {conflictLabel ? <div className="mt-0.5 truncate text-[10px] text-amber-700">{conflictLabel}</div> : null}
                            </div>
                            <span className="truncate text-xs text-slate-500">{row.email || 'no email'}</span>
                            <button
                              type="button"
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (row.department) addEntireDepartment(row.department);
                              }}
                              className={`truncate text-left text-xs ${row.department ? 'text-slate-600 hover:text-primary' : 'text-slate-400'}`}
                              title={
                                row.department
                                  ? t({ it: 'Tasto destro: aggiungi tutto il reparto', en: 'Right click: add whole department' })
                                  : undefined
                              }
                            >
                              {row.department || '—'}
                            </button>
                            <span className="truncate text-xs text-slate-500">{row.phone || '—'}</span>
                            {selected ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => toggleParticipantOptional(String(selectedRow?.key || `real:${row.externalId}`))}
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${selectedRow?.optional ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}
                                >
                                  {t({ it: 'Facoltativo', en: 'Optional' })}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleParticipantRemote(String(selectedRow?.key || `real:${row.externalId}`))}
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${selectedRow?.remote ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}
                                >
                                  {t({ it: 'Remoto', en: 'Remote' })}
                                </button>
                              </div>
                            ) : <span />}
                          </div>
                        </Fragment>
                      );
                    })}
                    {!filteredParticipants.length ? <div className="text-xs text-slate-500">{t({ it: 'Nessun utente trovato.', en: 'No users found.' })}</div> : null}
                  </div>
                  <div className={`mt-3 grid grid-cols-1 gap-2 ${manualCompanyIsOther ? 'lg:grid-cols-[1fr,1fr,1fr,auto,auto,auto]' : 'lg:grid-cols-[1fr,1fr,1fr,auto,auto,auto]'}`}>
                    <input
                      type="text"
                      autoComplete="off"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder={t({ it: 'Altri ospiti', en: 'Other guests' })}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={
                          manualCompanyIsOther
                            ? '__OTHER__'
                            : selectedClientBusinessPartners.includes(String(manualCompany || '').trim())
                              ? String(manualCompany || '').trim()
                              : ''
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '__OTHER__') {
                            setManualCompanyIsOther(true);
                            setManualCompany('');
                            return;
                          }
                          setManualCompanyIsOther(false);
                          setManualCompany(value);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">{t({ it: 'Azienda (opzionale)', en: 'Company (optional)' })}</option>
                        {selectedClientBusinessPartners.map((name: any) => (
                          <option key={`bp-opt-${name}`} value={name}>
                            {name}
                          </option>
                        ))}
                        <option value="__OTHER__">{t({ it: 'Altro', en: 'Other' })}</option>
                      </select>
                      {canOpenBusinessPartnersDirectory ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setBusinessPartnersModalOpen(true);
                          }}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700 hover:bg-slate-50"
                          title={t({ it: 'Apri rubrica Business Partner', en: 'Open Business Partner directory' })}
                        >
                          <Building2 size={14} />
                        </button>
                      ) : null}
                    </div>
                    <input
                      type="text"
                      autoComplete="off"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder={t({ it: 'Email (opzionale)', en: 'Email (optional)' })}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={manualOptional} onChange={(e) => setManualOptional(e.target.checked)} />
                      {t({ it: 'Facoltativo', en: 'Optional' })}
                    </label>
                    <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={manualRemote} onChange={(e) => setManualRemote(e.target.checked)} />
                      {t({ it: 'Remoto', en: 'Remote' })}
                    </label>
                    <button
                      type="button"
                      onClick={addManualParticipant}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Aggiungi', en: 'Add' })}
                    </button>
                    {manualCompanyIsOther ? (
                      <input
                        type="text"
                        autoComplete="off"
                        value={manualCompany}
                        onChange={(e) => setManualCompany(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder={t({ it: 'Nome azienda (Altro)', en: 'Company name (Other)' })}
                        className="lg:col-span-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    ) : null}
                  </div>
                  <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-auto rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
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
                          {row.kind === 'real_user' && row.externalId && formatParticipantConflictLabel(String(row.externalId || '')) ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              <AlertTriangle size={11} />
                              {t({ it: 'Occupato', en: 'Busy' })}
                            </span>
                          ) : null}
                          {row.optional ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">OPT</span> : null}
                          {row.remote ? <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">REM</span> : null}
                          {row.company ? <span className="max-w-[120px] truncate rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{row.company}</span> : null}
                          <button type="button" onClick={() => toggleParticipantOptional(row.key)} className="text-slate-500 hover:text-ink" title={t({ it: 'Facoltativo', en: 'Optional' })}>
                            O
                          </button>
                          <button type="button" onClick={() => toggleParticipantRemote(row.key)} className="text-slate-500 hover:text-indigo-700" title={t({ it: 'Remoto', en: 'Remote' })}>
                            R
                          </button>
                          <button type="button" onClick={() => removeParticipant(row.key)} className="text-slate-500 hover:text-rose-600" title={t({ it: 'Rimuovi', en: 'Remove' })}>
                            <X size={12} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">{t({ it: 'Nessun partecipante selezionato.', en: 'No participant selected.' })}</span>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeParticipantsModal}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t({ it: 'OK', en: 'OK' })}
                  </button>
                </div>
              </div>
            </Transition.Child>
          </div>
        </div>
      </div>
    </Transition>
  );
};

export const EarliestSuggestionsOverlay = (props: any) => {
  const { applySuggestedRoomStart, closeEarliestSuggestionsModal, earliestRoomSuggestions, earliestSuggestionsModalOpen, selectedSlotStartTs, t, open } = props;
  return (
    <Transition show={earliestSuggestionsModalOpen && open} as={Fragment}>
      <div
        className="fixed inset-0 z-[93] pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label={t({ it: 'Prime salette disponibili', en: 'First available rooms' })}
      >
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div
            className="pointer-events-auto fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              closeEarliestSuggestionsModal();
            }}
          />
        </Transition.Child>
        <div className="pointer-events-auto fixed inset-0 overflow-y-auto" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">{t({ it: 'Prima disponibilità', en: 'First availability' })}</h2>
                    <div className="text-xs text-slate-500">
                      {t({
                        it: 'Seleziona una saletta per aprire la configurazione meeting con il primo orario utile.',
                        en: 'Select a room to open meeting configuration with the first available time.'
                      })}
                    </div>
                  </div>
                  <button onClick={closeEarliestSuggestionsModal} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {earliestRoomSuggestions.map((row: any) => {
                    const d = new Date(Number(row.startAt));
                    const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    const isNowish = selectedSlotStartTs !== null && Math.abs(Number(row.startAt) - Number(selectedSlotStartTs)) < 60_000;
                    return (
                      <button
                        key={`earliest-${row.roomId}-${row.startAt}`}
                        type="button"
                        onClick={() => applySuggestedRoomStart(row.roomId, row.startAt)}
                        className="flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left hover:bg-emerald-100"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink">{row.roomName}</div>
                          <div className="truncate text-xs text-slate-600">{row.floorPlanName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-emerald-700">
                            {isNowish ? t({ it: 'Ora', en: 'Now' }) : hhmm}
                          </div>
                          <div className="text-[11px] text-slate-500">{t({ it: 'Apri configurazione', en: 'Open configuration' })}</div>
                        </div>
                      </button>
                    );
                  })}
                  {!earliestRoomSuggestions.length ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      {t({ it: 'Nessuna saletta suggerita disponibile.', en: 'No suggested room available.' })}
                    </div>
                  ) : null}
                </div>
              </div>
            </Transition.Child>
          </div>
        </div>
      </div>
    </Transition>
  );
};

export const ApprovalOverlay = (props: any) => {
  const { approvalModalOpen, closeApprovalModal, doReview, isAdmin, loadingPending, pendingRows, rejectReasonById, reloadPending, setRejectReasonById, t } = props;
  return (
      <Transition show={isAdmin && approvalModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[112]" onClose={closeApprovalModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <Dialog.Title className="text-lg font-semibold text-ink">
                      {t({ it: 'Richieste approvazione', en: 'Approval requests' })}
                    </Dialog.Title>
                    <button onClick={closeApprovalModal} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-end">
                      <button
                        onClick={reloadPending}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {loadingPending ? t({ it: 'Caricamento...', en: 'Loading...' }) : t({ it: 'Aggiorna', en: 'Refresh' })}
                      </button>
                    </div>
                    {!pendingRows.length ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        {t({ it: 'Nessuna richiesta pendente.', en: 'No pending requests.' })}
                      </div>
                    ) : (
                      <div className="max-h-[52vh] space-y-2 overflow-auto pr-1">
                        {pendingRows.map((row: any) => (
                          <div key={row.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <div className="font-semibold text-ink">{row.subject}</div>
                              <div className="text-xs text-slate-500">{new Date(row.startAt).toLocaleString()}</div>
                            </div>
                            <div className="text-xs text-slate-600">
                              {row.roomName} • {row.requestedByUsername} • {row.requestedSeats}/{row.roomCapacity}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                value={rejectReasonById[row.id] || ''}
                                onChange={(e) => setRejectReasonById((prev: any) => ({ ...prev, [row.id]: e.target.value }))}
                                placeholder={t({ it: 'Motivazione rifiuto (obbligatoria)', en: 'Reject reason (required)' })}
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                              />
                              <button
                                onClick={() => doReview(row, 'approve')}
                                className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                {t({ it: 'Approva', en: 'Approve' })}
                              </button>
                              <button
                                onClick={() => doReview(row, 'reject')}
                                className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                              >
                                {t({ it: 'Rifiuta', en: 'Reject' })}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};

export const RoomPreviewOverlay = (props: any) => {
  const { closeRoomPreview, previewData, roomPreview, t } = props;
  return (
      <Transition show={!!roomPreview} as={Fragment}>
        <Dialog as="div" className="relative z-[113]" onClose={closeRoomPreview}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {t({ it: 'Planimetria meeting room', en: 'Meeting room floor plan' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {previewData
                          ? `${previewData.clientName} > ${previewData.siteName} > ${previewData.planName}`
                          : t({ it: 'Dati non disponibili', en: 'Data not available' })}
                      </div>
                    </div>
                    <button onClick={closeRoomPreview} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-3">
                    {previewData ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <svg viewBox={previewData.viewBox} className="h-[58vh] w-full rounded-lg bg-white">
                          {previewData.planImageUrl && previewData.planWidth > 0 && previewData.planHeight > 0 ? (
                            <image
                              href={previewData.planImageUrl}
                              xlinkHref={previewData.planImageUrl}
                              x={previewData.planImageX || 0}
                              y={previewData.planImageY || 0}
                              width={previewData.planWidth}
                              height={previewData.planHeight}
                              preserveAspectRatio="none"
                              opacity={0.9}
                            />
                          ) : null}
                          {previewData.rooms.map((room: any) => {
                            const points = room.points.map((p: any) => `${p.x},${p.y}`).join(' ');
                            const selected = room.id === previewData.roomId;
                            const roomFill = selected
                              ? 'rgba(34,197,94,0.35)'
                              : room.meetingRoom
                                ? 'rgba(14,165,233,0.14)'
                                : 'rgba(255,255,255,0)';
                            const roomStroke = selected ? '#16a34a' : room.meetingRoom ? '#0284c7' : '#94a3b8';
                            return (
                              <g key={room.id}>
                                <polygon
                                  points={points}
                                  fill={roomFill}
                                  stroke={roomStroke}
                                  strokeWidth={selected ? 2 : 1.1}
                                />
                                {room.meetingRoom && room.center ? (
                                  <text
                                    x={room.center.x}
                                    y={room.center.y}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fontSize={16}
                                    fontWeight={selected ? 700 : 600}
                                    fill={selected ? '#166534' : '#0f172a'}
                                  >
                                    {room.name || t({ it: 'Meeting room', en: 'Meeting room' })}
                                  </text>
                                ) : null}
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        {t({ it: 'Impossibile mostrare la planimetria per questa sala.', en: 'Unable to render floor plan for this room.' })}
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};
