import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { CheckCircle2, Info, Pencil, Plus, RefreshCw, Trash2, X, XCircle } from 'lucide-react';
import Icon from '../ui/Icon';
import type { IconName } from '../../store/types';
import { WIFI_STANDARD_OPTIONS } from '../../store/data';
import type { CustomFieldDraft } from '../../api/objectTypeRequests';
import { polygonPath } from './ObjectTypesPanel.helpers';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Modals extracted verbatim from ObjectTypesPanel to keep it under 2k lines. Render-only.

export const RequestsModal = (props: any) => {
  const { addDraftField, canManageRequests, canRequestObjects, countAccepted, countPending, countRejected, deleteObjectTypeRequest, draftFieldRefs, draftFields, draftIcon, draftNameEn, draftNameIt, draftTypeId, editRequestId, formatStamp, iconOptions, isSuperAdmin, myRequests, pendingCount, push, reloadRequests, removeDraftField, requests, requestsLoading, requestsOpen, requestsTab, resetRequestDraft, resolveRequest, reviewReason, selectedRequest, selectedRequestId, setDraftFields, setDraftIcon, setDraftNameEn, setDraftNameIt, setDraftTypeId, setEditRequestId, setRequestsOpen, setRequestsTab, setReviewReason, setSelectedRequestId, submitRequest, t, toDraftFields, updateDraftField } = props;
  return (
      <Transition show={requestsOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setRequestsOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-5xl modal-panel">
                  <div className="modal-header items-center">
                    <div className="flex items-center gap-2">
                      <Dialog.Title className="modal-title">
                        {t(canManageRequests ? { it: 'Richieste utenti', en: 'User requests' } : { it: 'Richieste oggetti', en: 'Object requests' })}
                      </Dialog.Title>
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                        title={t({
                          it: 'Invia una richiesta di nuovo oggetto. Il superadmin può approvare, rifiutare con motivazione o modificare i campi. Finché non è approvata, puoi modificare o eliminare la richiesta.',
                          en: 'Submit a new object request. The superadmin can approve, reject with a reason, or edit fields. Until it is approved, you can edit or delete the request.'
                        })}
                      >
                        <Info size={14} />
                      </button>
                    </div>
                    <button onClick={() => setRequestsOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canRequestObjects ? (
                      <>
                        <button
                          onClick={() => {
                            setRequestsTab('new');
                            resetRequestDraft();
                          }}
                          className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                            requestsTab === 'new' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink'
                          }`}
                          title={t({ it: 'Apri la nuova richiesta oggetto', en: 'Open new object request' })}
                        >
                          {t({ it: 'Nuova richiesta', en: 'New request' })}
                        </button>
                        <button
                          onClick={() => setRequestsTab('mine')}
                          className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                            requestsTab === 'mine' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink'
                          }`}
                          title={t({ it: 'Mostra le tue richieste', en: 'Show your requests' })}
                        >
                          {t({ it: 'Le mie richieste', en: 'My requests' })}
                        </button>
                      </>
                    ) : null}
                    {canManageRequests ? (
                      <button
                        onClick={() => setRequestsTab('manage')}
                        className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                          requestsTab === 'manage' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-ink'
                        }`}
                        title={t({ it: 'Gestisci le richieste utenti', en: 'Manage user requests' })}
                      >
                        {t({ it: 'Richieste utenti', en: 'User requests' })}
                      </button>
                    ) : null}
                    {!isSuperAdmin ? (
                      <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                          {t({ it: 'Accettate', en: 'Accepted' })}: {countAccepted}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                          {t({ it: 'Pending', en: 'Pending' })}: {countPending}
                        </span>
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                          {t({ it: 'Rifiutate', en: 'Rejected' })}: {countRejected}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {requestsTab === 'new' && canRequestObjects ? (
                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'ID oggetto', en: 'Object ID' })} <span className="text-rose-600">*</span>
                        <input
                          value={draftTypeId}
                          onChange={(e) => setDraftTypeId(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder="es. sensor_temperature"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Nome (IT)', en: 'Name (IT)' })} <span className="text-rose-600">*</span>
                        <input
                          value={draftNameIt}
                          onChange={(e) => setDraftNameIt(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder="Es. Sensore temperatura"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Nome (EN)', en: 'Name (EN)' })} <span className="text-rose-600">*</span>
                        <input
                          value={draftNameEn}
                          onChange={(e) => setDraftNameEn(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder="e.g. Temperature sensor"
                        />
                      </label>
                      <div className="text-sm font-medium text-slate-700">
                        {t({ it: 'Icona', en: 'Icon' })} <span className="text-rose-600">*</span>
                        <div className="mt-2 grid grid-cols-6 gap-2">
                          {iconOptions.map((name: any) => (
                            <button
                              key={name}
                              onClick={() => setDraftIcon(name)}
                              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                                draftIcon === name ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600'
                              }`}
                              title={name}
                            >
                              <Icon name={name} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="lg:col-span-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-ink">{t({ it: 'Campi custom', en: 'Custom fields' })}</div>
                          <button
                            onClick={addDraftField}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            title={t({ it: 'Aggiungi un nuovo campo custom', en: 'Add a new custom field' })}
                          >
                            <Plus size={14} /> {t({ it: 'Aggiungi campo', en: 'Add field' })}
                          </button>
                        </div>
                        <div className="mt-2 space-y-2">
                          {draftFields.length ? (
                            draftFields.map((f: any, idx: number) => (
                              <div key={f.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-[2fr_1fr_auto]">
                                <input
                                  ref={(node) => {
                                    draftFieldRefs.current[f.id] = node;
                                  }}
                                  value={f.label}
                                  onChange={(e) => updateDraftField(idx, { label: e.target.value })}
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                  placeholder={t({ it: 'Etichetta campo', en: 'Field label' })}
                                />
                                <select
                                  value={f.valueType}
                                  onChange={(e) => updateDraftField(idx, { valueType: e.target.value as CustomFieldDraft['valueType'] })}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                >
                                  <option value="string">{t({ it: 'Testo', en: 'Text' })}</option>
                                  <option value="number">{t({ it: 'Numero', en: 'Number' })}</option>
                                  <option value="boolean">{t({ it: 'Booleano', en: 'Boolean' })}</option>
                                </select>
                                <button
                                  onClick={() => removeDraftField(idx)}
                                  className="btn-inline-danger"
                                  title={t({ it: 'Rimuovi campo', en: 'Remove field' })}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-500">{t({ it: 'Nessun campo custom aggiunto.', en: 'No custom fields added.' })}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {requestsTab === 'new' && canRequestObjects ? (
                    <div className="modal-footer">
                      <button
                        onClick={() => setRequestsOpen(false)}
                        className="btn-secondary"
                        title={t({ it: 'Chiudi senza inviare la richiesta', en: 'Close without sending the request' })}
                      >
                        {t({ it: 'Annulla', en: 'Cancel' })}
                      </button>
                      <button
                        onClick={submitRequest}
                        className="btn-primary"
                        title={t({ it: 'Invia o aggiorna la richiesta', en: 'Send or update the request' })}
                      >
                        {editRequestId ? t({ it: 'Aggiorna richiesta', en: 'Update request' }) : t({ it: 'Invia richiesta', en: 'Send request' })}
                      </button>
                    </div>
                  ) : null}

                  {requestsTab === 'mine' && canRequestObjects ? (
                    <div className="mt-4 space-y-2">
                      {countPending === 0 ? (
                        <div className="text-sm text-slate-500">{t({ it: 'Nessuna richiesta in pending.', en: 'No pending requests.' })}</div>
                      ) : null}
                      {myRequests.length ? (
                        myRequests.map((r: any) => {
                          const badgeClass =
                            r.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700'
                              : r.status === 'rejected'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-800';
                          const canEdit = r.status !== 'approved';
                          return (
                            <div key={r.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold text-ink">
                                  {(r.payload?.nameIt || '').trim() || r.payload?.typeId}
                                  <span className="ml-2 text-xs text-slate-500">({r.payload?.typeId})</span>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                                  {r.status === 'approved'
                                    ? t({ it: 'Approvata', en: 'Approved' })
                                    : r.status === 'rejected'
                                      ? t({ it: 'Rifiutata', en: 'Rejected' })
                                      : t({ it: 'In attesa', en: 'Pending' })}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {t({ it: 'Richiesta', en: 'Requested' })}: {formatStamp(r.requestedAt)} ·{' '}
                                {t({ it: 'Esito', en: 'Decision' })}: {formatStamp(r.reviewedAt || undefined)}
                              </div>
                              {r.reason ? <div className="mt-1 text-xs text-rose-700">{r.reason}</div> : null}
                              <div className="mt-2 flex justify-end gap-2">
                                {canEdit ? (
                                  <button
                                    onClick={() => {
                                      setRequestsTab('new');
                                      setEditRequestId(r.id);
                                      setDraftTypeId(r.payload?.typeId || '');
                                      setDraftNameIt(r.payload?.nameIt || '');
                                      setDraftNameEn(r.payload?.nameEn || '');
                                      setDraftIcon((r.payload?.icon || 'user') as IconName);
                                      setDraftFields(toDraftFields(r.payload?.customFields || []));
                                    }}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    title={t({ it: 'Modifica la richiesta', en: 'Edit the request' })}
                                  >
                                    <Pencil size={14} /> {t({ it: 'Modifica', en: 'Edit' })}
                                  </button>
                                ) : null}
                                {canEdit ? (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await deleteObjectTypeRequest(r.id);
                                        push(t({ it: 'Richiesta eliminata', en: 'Request deleted' }), 'info');
                                        await reloadRequests();
                                      } catch {
                                        push(t({ it: 'Eliminazione non riuscita', en: 'Failed to delete request' }), 'danger');
                                      }
                                    }}
                                    className="btn-inline-danger gap-2 px-3 py-1.5"
                                    title={t({ it: 'Elimina la richiesta', en: 'Delete the request' })}
                                  >
                                    <Trash2 size={14} /> {t({ it: 'Elimina', en: 'Delete' })}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      ) : null}
                    </div>
                  ) : null}

                  {canManageRequests && requestsTab === 'manage' ? (
                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1.4fr]">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-ink">{t({ it: 'Richieste', en: 'Requests' })}</div>
                          <button
                            onClick={reloadRequests}
                            className="btn-inline gap-2 px-2 py-1"
                            title={t({ it: 'Aggiorna la lista richieste', en: 'Refresh the requests list' })}
                          >
                            <RefreshCw size={12} /> {t({ it: 'Aggiorna', en: 'Refresh' })}
                          </button>
                        </div>
                        {pendingCount === 0 ? (
                          <div className="text-sm text-slate-500">{t({ it: 'Nessuna richiesta in pending.', en: 'No pending requests.' })}</div>
                        ) : null}
                        {requestsLoading ? (
                          <div className="text-sm text-slate-500">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
                        ) : requests.length ? (
                          requests.map((r: any) => {
                            const badge =
                              r.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700'
                                : r.status === 'rejected'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-amber-50 text-amber-800';
                            return (
                              <button
                                key={r.id}
                                onClick={() => setSelectedRequestId(r.id)}
                                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                                  selectedRequestId === r.id ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'
                                }`}
                                title={t({ it: 'Apri dettagli richiesta', en: 'Open request details' })}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-semibold text-ink">{r.payload?.nameIt || r.payload?.typeId}</div>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>
                                    {r.status === 'approved'
                                      ? t({ it: 'Approvata', en: 'Approved' })
                                      : r.status === 'rejected'
                                        ? t({ it: 'Rifiutata', en: 'Rejected' })
                                        : t({ it: 'In attesa', en: 'Pending' })}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {r.requestedBy?.username} · {formatStamp(r.requestedAt)}
                                </div>
                              </button>
                            );
                          })
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        {selectedRequest ? (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-ink">{selectedRequest.payload?.typeId}</div>
                              <div className="text-xs text-slate-500">{formatStamp(selectedRequest.requestedAt)}</div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3">
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'ID oggetto', en: 'Object ID' })}
                                <input
                                  value={draftTypeId}
                                  onChange={(e) => setDraftTypeId(e.target.value)}
                                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Nome (IT)', en: 'Name (IT)' })}
                                <input
                                  value={draftNameIt}
                                  onChange={(e) => setDraftNameIt(e.target.value)}
                                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Nome (EN)', en: 'Name (EN)' })}
                                <input
                                  value={draftNameEn}
                                  onChange={(e) => setDraftNameEn(e.target.value)}
                                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                              <div className="text-sm font-medium text-slate-700">
                                {t({ it: 'Icona', en: 'Icon' })}
                                <div className="mt-2 grid grid-cols-6 gap-2">
                                  {iconOptions.map((name: any) => (
                                    <button
                                      key={name}
                                      onClick={() => setDraftIcon(name)}
                                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                                        draftIcon === name ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600'
                                      }`}
                                      title={name}
                                    >
                                      <Icon name={name} />
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-semibold text-ink">{t({ it: 'Campi custom', en: 'Custom fields' })}</div>
                                  <button
                                    onClick={addDraftField}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    title={t({ it: 'Aggiungi un nuovo campo custom', en: 'Add a new custom field' })}
                                  >
                                    <Plus size={14} /> {t({ it: 'Aggiungi campo', en: 'Add field' })}
                                  </button>
                                </div>
                                <div className="mt-2 space-y-2">
                                  {draftFields.length ? (
                                    draftFields.map((f: any, idx: number) => (
                                      <div key={f.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-[2fr_1fr_auto]">
                                        <input
                                          ref={(node) => {
                                            draftFieldRefs.current[f.id] = node;
                                          }}
                                          value={f.label}
                                          onChange={(e) => updateDraftField(idx, { label: e.target.value })}
                                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                          placeholder={t({ it: 'Etichetta campo', en: 'Field label' })}
                                        />
                                        <select
                                          value={f.valueType}
                                          onChange={(e) => updateDraftField(idx, { valueType: e.target.value as CustomFieldDraft['valueType'] })}
                                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                        >
                                          <option value="string">{t({ it: 'Testo', en: 'Text' })}</option>
                                          <option value="number">{t({ it: 'Numero', en: 'Number' })}</option>
                                          <option value="boolean">{t({ it: 'Booleano', en: 'Boolean' })}</option>
                                        </select>
                                        <button
                                          onClick={() => removeDraftField(idx)}
                                          className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-rose-700 hover:bg-rose-100"
                                          title={t({ it: 'Rimuovi campo', en: 'Remove field' })}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-slate-500">{t({ it: 'Nessun campo custom aggiunto.', en: 'No custom fields added.' })}</div>
                                  )}
                                </div>
                              </div>
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Motivazione (solo rifiuto)', en: 'Reason (for rejection)' })}
                                <textarea
                                  value={reviewReason}
                                  onChange={(e) => setReviewReason(e.target.value)}
                                  className="mt-1 h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                            </div>
                            {selectedRequest.status === 'pending' ? (
                              <div className="mt-4 flex justify-end gap-2">
                                <button
                                  onClick={() => resolveRequest('rejected')}
                                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                                  title={t({ it: 'Rifiuta la richiesta selezionata', en: 'Reject the selected request' })}
                                >
                                  <XCircle size={16} /> {t({ it: 'Rifiuta', en: 'Reject' })}
                                </button>
                                <button
                                  onClick={() => resolveRequest('approved')}
                                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                                  title={t({ it: 'Approva la richiesta selezionata', en: 'Approve the selected request' })}
                                >
                                  <CheckCircle2 size={16} /> {t({ it: 'Approva', en: 'Approve' })}
                                </button>
                              </div>
                            ) : (
                              <div className="mt-4 text-xs font-semibold uppercase text-slate-500">
                                {selectedRequest.status === 'approved'
                                  ? t({ it: 'Richiesta approvata', en: 'Request approved' })
                                  : t({ it: 'Richiesta rifiutata', en: 'Request rejected' })}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-slate-500">{t({ it: 'Seleziona una richiesta.', en: 'Select a request.' })}</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};

export const CustomTypeModal = (props: any) => {
  const { addDraftField, customOpen, draftFieldRefs, draftFields, draftIcon, draftNameEn, draftNameIt, draftTypeId, iconOptions, removeDraftField, setCustomOpen, setDraftIcon, setDraftNameEn, setDraftNameIt, setDraftTypeId, submitCustomObject, t, updateDraftField } = props;
  return (
      <Transition show={customOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setCustomOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-3xl modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Nuovo oggetto', en: 'New object' })}</Dialog.Title>
                    <button onClick={() => setCustomOpen(false)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'ID oggetto', en: 'Object ID' })} <span className="text-rose-600">*</span>
                      <input
                        value={draftTypeId}
                        onChange={(e) => setDraftTypeId(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder="es. sensor_temperature"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Nome (IT)', en: 'Name (IT)' })} <span className="text-rose-600">*</span>
                      <input
                        value={draftNameIt}
                        onChange={(e) => setDraftNameIt(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder="Es. Sensore temperatura"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Nome (EN)', en: 'Name (EN)' })} <span className="text-rose-600">*</span>
                      <input
                        value={draftNameEn}
                        onChange={(e) => setDraftNameEn(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder="e.g. Temperature sensor"
                      />
                    </label>
                    <div className="text-sm font-medium text-slate-700">
                      {t({ it: 'Icona', en: 'Icon' })} <span className="text-rose-600">*</span>
                      <div className="mt-2 grid grid-cols-6 gap-2">
                        {iconOptions.map((name: any) => (
                          <button
                            key={name}
                            onClick={() => setDraftIcon(name)}
                            className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                              draftIcon === name ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600'
                            }`}
                            title={name}
                          >
                            <Icon name={name} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Campi custom', en: 'Custom fields' })}</div>
                      <button
                        onClick={addDraftField}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Aggiungi un nuovo campo custom', en: 'Add a new custom field' })}
                      >
                        <Plus size={14} /> {t({ it: 'Aggiungi campo', en: 'Add field' })}
                      </button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {draftFields.length ? (
                        draftFields.map((f: any, idx: number) => (
                          <div key={f.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-[2fr_1fr_auto]">
                            <input
                              ref={(node) => {
                                draftFieldRefs.current[f.id] = node;
                              }}
                              value={f.label}
                              onChange={(e) => updateDraftField(idx, { label: e.target.value })}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              placeholder={t({ it: 'Etichetta campo', en: 'Field label' })}
                            />
                            <select
                              value={f.valueType}
                              onChange={(e) => updateDraftField(idx, { valueType: e.target.value as CustomFieldDraft['valueType'] })}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            >
                              <option value="string">{t({ it: 'Testo', en: 'Text' })}</option>
                              <option value="number">{t({ it: 'Numero', en: 'Number' })}</option>
                              <option value="boolean">{t({ it: 'Booleano', en: 'Boolean' })}</option>
                            </select>
                            <button
                              onClick={() => removeDraftField(idx)}
                              className="btn-inline-danger"
                              title={t({ it: 'Rimuovi campo', en: 'Remove field' })}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500">{t({ it: 'Nessun campo custom aggiunto.', en: 'No custom fields added.' })}</div>
                      )}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setCustomOpen(false)}
                      className="btn-secondary"
                      title={t({ it: 'Chiudi senza creare l’oggetto', en: 'Close without creating the object' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={submitCustomObject}
                      className="btn-primary"
                      title={t({ it: 'Crea il nuovo oggetto', en: 'Create the new object' })}
                    >
                      {t({ it: 'Crea', en: 'Create' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};

export const DoorMapPreviewModal = (props: any) => {
  const { doorMapPreviewData, doorMapPreviewRow, setDoorMapPreviewRow, t } = props;
  return (
      <Transition show={!!doorMapPreviewRow} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setDoorMapPreviewRow(null)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-6xl modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Mirino porta su planimetria', en: 'Door crosshair on floor plan' })}</Dialog.Title>
                    <button onClick={() => setDoorMapPreviewRow(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  {doorMapPreviewRow ? (
                    <>
                      <div className="mt-2 text-xs text-slate-600">
                        <span className="font-semibold">{doorMapPreviewRow.clientName || '-'}</span> ·{' '}
                        <span className="font-semibold">{doorMapPreviewRow.siteName || '-'}</span> ·{' '}
                        <span className="font-semibold">{doorMapPreviewRow.planName || '-'}</span> ·{' '}
                        <span>{t({ it: 'Porta', en: 'Door' })}: </span>
                        <span className="font-mono">{doorMapPreviewRow.doorId}</span>
                      </div>
                      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <svg viewBox={doorMapPreviewData?.viewBox || '0 0 100 100'} className="h-[68vh] w-full">
                          {doorMapPreviewData?.corridorShapes.map((entry: any) => (
                            <path key={`c-${entry.corridor.id}`} d={polygonPath(entry.points)} fill="#e2e8f0" stroke="#64748b" strokeWidth={2} opacity={0.95} />
                          ))}
                          {doorMapPreviewData?.roomShapes.map((entry: any) => (
                            <Fragment key={`r-${entry.room.id}`}>
                              <path d={polygonPath(entry.points)} fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={1.6} />
                              {entry.center ? (
                                <text
                                  x={entry.center.x}
                                  y={entry.center.y}
                                  fill="#1e3a8a"
                                  fontSize={14}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  style={{ fontWeight: 700 }}
                                >
                                  {entry.room.name}
                                </text>
                              ) : null}
                            </Fragment>
                          ))}
                          {doorMapPreviewData?.doorAnchors.map((entry: any) => {
                            const isSelected =
                              entry.corridorId === doorMapPreviewRow.corridorId && String(entry.door?.id || '') === String(doorMapPreviewRow.doorId || '');
                            const isEmergency = !!(entry.door as any)?.isEmergency;
                            return (
                              <circle
                                key={`d-${entry.corridorId}-${entry.door.id}`}
                                cx={entry.point.x}
                                cy={entry.point.y}
                                r={isSelected ? 6.5 : 4.8}
                                fill={isSelected ? '#f97316' : isEmergency ? '#ef4444' : '#334155'}
                                stroke={isSelected ? '#7c2d12' : '#ffffff'}
                                strokeWidth={2}
                              />
                            );
                          })}
                        </svg>
                      </div>
                    </>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};

export const WifiModelModal = (props: any) => {
  const { lang, saveWifiModel, setWifiDraft, setWifiModal, t, wifiDraft, wifiDraftValid, wifiModal } = props;
  return (
      <Transition show={!!wifiModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setWifiModal(null)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-lg modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">
                      {t({
                        it: wifiModal?.mode === 'edit' ? 'Modifica modello WiFi' : 'Nuovo modello WiFi',
                        en: wifiModal?.mode === 'edit' ? 'Edit WiFi model' : 'New WiFi model'
                      })}
                    </Dialog.Title>
                    <button onClick={() => setWifiModal(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Marca', en: 'Brand' })}
                      <input
                        value={wifiDraft.brand}
                        onChange={(e) => setWifiDraft((prev: any) => ({ ...prev, brand: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. Ubiquiti', en: 'e.g. Ubiquiti' })}
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Modello', en: 'Model' })}
                      <input
                        value={wifiDraft.model}
                        onChange={(e) => setWifiDraft((prev: any) => ({ ...prev, model: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. U7 Pro', en: 'e.g. U7 Pro' })}
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Codice modello', en: 'Model code' })}
                      <input
                        value={wifiDraft.modelCode}
                        onChange={(e) => setWifiDraft((prev: any) => ({ ...prev, modelCode: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. U7-Pro', en: 'e.g. U7-Pro' })}
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Standard WiFi', en: 'WiFi standard' })}
                      <select
                        value={wifiDraft.standard}
                        onChange={(e) => setWifiDraft((prev: any) => ({ ...prev, standard: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      >
                        {WIFI_STANDARD_OPTIONS.map((opt: any) => (
                          <option key={opt.id} value={opt.id}>
                            {lang === 'it' ? opt.it : opt.en}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <div className="text-sm font-medium text-slate-700">{t({ it: 'Bande', en: 'Bands' })}</div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={wifiDraft.band24}
                            onChange={(e) => setWifiDraft((prev: any) => ({ ...prev, band24: e.target.checked }))}
                          />
                          2.4 GHz
                        </label>
                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={wifiDraft.band5}
                            onChange={(e) => setWifiDraft((prev: any) => ({ ...prev, band5: e.target.checked }))}
                          />
                          5 GHz
                        </label>
                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={wifiDraft.band6}
                            onChange={(e) => setWifiDraft((prev: any) => ({ ...prev, band6: e.target.checked }))}
                          />
                          6 GHz
                        </label>
                      </div>
                    </div>
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Copertura (m2)', en: 'Coverage (m2)' })}
                      <input
                        value={wifiDraft.coverageSqm}
                        onChange={(e) => setWifiDraft((prev: any) => ({ ...prev, coverageSqm: e.target.value }))}
                        inputMode="decimal"
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. 185', en: 'e.g. 185' })}
                      />
                    </label>
                    {!wifiDraftValid ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        {t({
                          it: 'Compila tutti i campi e seleziona almeno una banda.',
                          en: 'Fill all fields and select at least one band.'
                        })}
                      </div>
                    ) : null}
                  </div>
                  <div className="modal-footer">
                    <button
                      onClick={() => setWifiModal(null)}
                      className="btn-secondary"
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      onClick={saveWifiModel}
                      disabled={!wifiDraftValid}
                      className={`btn-primary ${wifiDraftValid ? '' : 'cursor-not-allowed opacity-60'}`}
                    >
                      {t({ it: 'Salva', en: 'Save' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};

export const DoorHistoryModal = (props: any) => {
  const { doorHistoryRow, setDoorHistoryRow, t } = props;
  return (
      <Transition show={!!doorHistoryRow} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setDoorHistoryRow(null)}>
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-3xl modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">
                      {t({ it: 'Storico verifiche porta emergenza', en: 'Emergency door verification history' })}
                    </Dialog.Title>
                    <button onClick={() => setDoorHistoryRow(null)} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  {doorHistoryRow ? (
                    <>
                      <div className="mt-2 text-xs text-slate-600">
                        {doorHistoryRow.clientName} · {doorHistoryRow.siteName} · {doorHistoryRow.planName} · {t({ it: 'Porta', en: 'Door' })}:{' '}
                        <span className="font-mono">{doorHistoryRow.doorId}</span>
                      </div>
                      <div className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-slate-200 bg-white">
                        {(doorHistoryRow.verificationHistory || []).length ? (
                          <div className="divide-y divide-slate-100">
                            {doorHistoryRow.verificationHistory.map((entry: any) => (
                              <div key={entry.id} className="px-4 py-3">
                                <div className="text-sm font-semibold text-ink">{entry.company || '—'}</div>
                                <div className="mt-1 text-xs text-slate-600">
                                  {t({ it: 'Data verifica', en: 'Check date' })}: {entry.date || '—'}
                                </div>
                                {entry.notes ? <div className="mt-1 text-xs text-slate-600">{entry.notes}</div> : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="px-4 py-6 text-sm text-slate-500">
                            {t({ it: 'Nessuna verifica registrata per questa porta.', en: 'No checks registered for this door.' })}
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
  );
};
