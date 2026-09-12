// @ts-nocheck
import { Dialog } from '@headlessui/react';
import { Cable, Copy, Link2, Trash, X } from 'lucide-react';
import RackPortsModal from './RackPortsModal';
import { RackPromptModals } from './RackPromptModals';
import type { RackItemType } from '../../store/types';
import { typeLabels, typeColors, unitHeight } from './RackModal.helpers';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Entire RackModal render body extracted verbatim to keep RackModal.tsx (logic) under 2k.
// Render-only; all state/handlers/render-helpers arrive via props.

export const RackModalBody = (props: any) => {
  const { name, addActionLabel, addDetails, addPrompt, addPromptFocusRef, addRackLink, addUnitSize, allRackItems, contextMenu, createRackItemAt, deletePrompt, deleteRackItem, deleteRackLink, draft, duplicateRackName, editDetails, editPrompt, editUnitSize, filteredRackItems, formatItemLabel, freeUnits, getTypeLabel, handleAddItem, handleConfirmAdd, handleConfirmDelete, handleConfirmEdit, handleDrop, handleExportRackPdf, handleRackClose, handleRenamePort, handleSaveItem, handleSavePortNote, handleSaveRack, hasEth, hasFiber, hasHostName, hasPorts, isSlotFree, itemCard, maxContiguousFree, normalizeIp, onClose, openClonePrompt, openEditPrompt, open, plan, portsModalItem, portsModalItemId, portsModalShowConnections, rackDialogFocusRef, rackDisplayName, rackHeight, rackItems, rackNameInputClass, rackNotes, rackNotesDirtyRef, rackRef, rackSearch, rackViewRef, readOnly, selectedItem, selectedNameRef, selectionRef, setAddDetails, setAddPrompt, setAddUnitSize, setContextMenu, setDeletePrompt, setDraft, setEditDetails, setEditPrompt, setEditUnitSize, setName, setPortsModalItemId, setPortsModalShowConnections, setRackNotes, setRackSearch, setSelectedItemId, setTotalUnits, t, totalUnits, toUrl, updateRackItem } = props;
  return (
    <>
      <Dialog open={open} as="div" className="relative z-[80]" onClose={handleRackClose} initialFocus={rackDialogFocusRef}>
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-6">
            <Dialog.Panel className="w-full max-w-6xl modal-panel">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Dialog.Title className="modal-title">{t({ it: 'Gestione rack', en: 'Rack editor' })}</Dialog.Title>
                    <div className="text-xs text-slate-500">
                      {t({ it: 'Inserisci apparati ed imposta la posizione nel rack', en: 'Add devices and set their position in the rack.' })}
                    </div>
                  </div>
                  <button
                    ref={rackDialogFocusRef}
                    onClick={onClose}
                    className="text-slate-500 hover:text-ink"
                    title={t({ it: 'Chiudi', en: 'Close' })}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr_340px]">
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Rack', en: 'Rack' })}</div>
                      <label className="mt-2 block text-sm font-medium text-slate-700">
                        {t({ it: 'Nome rack', en: 'Rack name' })}
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${rackNameInputClass}`}
                        />
                        {duplicateRackName ? (
                          <div className="mt-1 text-xs font-semibold text-rose-600">
                            {t({
                              it: 'Nome già usato nella planimetria.',
                              en: 'Name already used in this floor plan.'
                            })}
                          </div>
                        ) : null}
                      </label>
                      <label className="mt-2 block text-sm font-medium text-slate-700">
                        {t({ it: 'Unità totali (U)', en: 'Total units (U)' })}
                        <input
                          type="number"
                          min={6}
                          max={60}
                          value={totalUnits}
                          onChange={(e) => setTotalUnits(Math.max(6, Math.min(60, Number(e.target.value) || 42)))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        />
                      </label>
                      <label className="mt-2 block text-sm font-medium text-slate-700">
                        {t({ it: 'Note rack', en: 'Rack notes' })}
                        <textarea
                          rows={3}
                          value={rackNotes}
                          onChange={(e) => {
                            rackNotesDirtyRef.current = true;
                            setRackNotes(e.target.value);
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        />
                      </label>
                      <button
                        onClick={handleSaveRack}
                        disabled={readOnly}
                        className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold text-white ${readOnly ? 'bg-slate-300' : 'bg-primary hover:bg-primary/90'}`}
                        title={t({ it: 'Salva rack', en: 'Save rack' })}
                      >
                        {t({ it: 'Salva rack', en: 'Save rack' })}
                      </button>
                      <button
                        onClick={handleExportRackPdf}
                        className="mt-2 w-full btn-secondary"
                        title={t({ it: 'Esporta PDF rack', en: 'Export rack PDF' })}
                      >
                        {t({ it: 'Esporta PDF rack', en: 'Export rack PDF' })}
                      </button>
                      <button
                        onClick={() => setDeletePrompt({ mode: 'all' })}
                        disabled={readOnly || rackItems.length === 0}
                        className={`mt-2 w-full rounded-lg px-3 py-2 text-sm font-semibold ${
                          readOnly || rackItems.length === 0
                            ? 'bg-slate-100 text-slate-400'
                            : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                        title={t({ it: 'Elimina tutti gli apparati', en: 'Delete all devices' })}
                      >
                        {t({ it: 'Elimina tutti gli apparati', en: 'Delete all devices' })}
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Apparati', en: 'Devices' })}</div>
                      <div className="mt-2 flex flex-col gap-2">
                        {(Object.keys(typeLabels) as RackItemType[]).map((type) => (
                          <button
                            key={type}
                            onClick={() => handleAddItem(type)}
                            disabled={readOnly}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/plixmap-rack-type', type);
                                                            e.dataTransfer.effectAllowed = 'copy';
                            }}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            style={{ borderLeftColor: typeColors[type] || '#cbd5f5', borderLeftWidth: 4 }}
                            title={t({ it: `Aggiungi ${typeLabels[type].it}`, en: `Add ${typeLabels[type].en}` })}
                          >
                            <span>{getTypeLabel(type)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">
                      <span>{t({ it: 'Vista rack', en: 'Rack view' })}</span>
                      <span className="flex items-center gap-2">
                        {addPrompt?.step === 'place' ? (
                          <>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {t({ it: 'Seleziona lo slot', en: 'Select a slot' })}
                            </span>
                            <button
                              onClick={() => setAddPrompt(null)}
                              className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                              title={t({ it: 'Annulla', en: 'Cancel' })}
                            >
                              {t({ it: 'Annulla', en: 'Cancel' })}
                            </button>
                          </>
                        ) : null}
                        <span>{t({ it: 'Unità disponibili', en: 'Available units' })} {freeUnits}</span>
                        <span>{t({ it: 'Max contigue', en: 'Max contiguous' })} {maxContiguousFree()}</span>
                        <span>{totalUnits}U</span>
                      </span>
                    </div>
                    <div className="mt-2">
                      <input
                        value={rackSearch}
                        onChange={(e) => setRackSearch(e.target.value)}
                        placeholder={t({ it: 'Cerca apparati o host...', en: 'Search devices or host...' })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 outline-none ring-primary/30 focus:ring-2"
                      />
                    </div>
                    <div ref={rackViewRef} className="mt-3 grid grid-cols-[34px_1fr] gap-2">
                      <div className="flex flex-col-reverse items-end">
                        {Array.from({ length: totalUnits }, (_, idx) => (
                          <div key={idx} className="h-[22px] text-[10px] text-slate-400">
                            {idx + 1}U
                          </div>
                        ))}
                      </div>
      <div
        ref={rackRef}
        onPointerDownCapture={(e) => {
          if (e.button !== 0 || e.ctrlKey) return;
          if (addPrompt?.step === 'place') return;
          const target = e.target as HTMLElement | null;
          const holder = target?.closest?.('[data-rack-item-id]') as HTMLElement | null;
          const id = holder?.getAttribute('data-rack-item-id');
          if (id) {
            selectionRef.current = { id, ts: Date.now() };
            setSelectedItemId(id);
          }
        }}
        onMouseDown={(e) => {
          if (e.button !== 0 || e.ctrlKey) return;
          if (addPrompt?.step === 'place') return;
          const target = e.target as HTMLElement | null;
          const holder = target?.closest?.('[data-rack-item-id]') as HTMLElement | null;
          const id = holder?.getAttribute('data-rack-item-id');
          if (id) {
            selectionRef.current = { id, ts: Date.now() };
            setSelectedItemId(id);
            return;
          }
        }}
        onContextMenu={(e) => {
          if (e.ctrlKey) return;
          const target = e.target as HTMLElement | null;
          const holder = target?.closest?.('[data-rack-item-id]') as HTMLElement | null;
          const id = holder?.getAttribute('data-rack-item-id');
          if (!id) return;
          e.preventDefault();
          e.stopPropagation();
          selectionRef.current = { id, ts: Date.now() };
          setSelectedItemId(id);
          setContextMenu({ x: e.clientX, y: e.clientY, itemId: id });
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        tabIndex={0}
        onKeyDown={(e) => {
          if (!selectedItem) return;
                          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                          e.preventDefault();
                          const delta = e.key === 'ArrowUp' ? 1 : -1;
                          const nextStart = Math.max(1, Math.min(totalUnits - selectedItem.unitSize + 1, selectedItem.unitStart + delta));
                          if (nextStart === selectedItem.unitStart) return;
                          if (!isSlotFree(nextStart, selectedItem.unitSize, selectedItem.id)) return;
                          updateRackItem(plan.id, selectedItem.id, { unitStart: nextStart });
                        }}
                        className="relative rounded-xl border border-dashed border-slate-300 bg-slate-100"
                        style={{ height: rackHeight }}
        onClick={(e) => {
          if (!addPrompt || addPrompt.step !== 'place') return;
          const target = e.target as HTMLElement | null;
          if (target?.closest?.('[data-rack-item-id]')) return;
          const container = rackRef.current;
          if (!container) return;
          const rect = container.getBoundingClientRect();
          const y = e.clientY - rect.top;
                          const fromTop = Math.max(0, Math.min(totalUnits - 1, Math.floor(y / unitHeight)));
                          const start = totalUnits - fromTop - addPrompt.unitSize + 1;
                          const clamped = Math.max(1, Math.min(totalUnits - addPrompt.unitSize + 1, start));
                          createRackItemAt(addPrompt.type, addPrompt.unitSize, clamped);
                        }}
                      >
                        {addPrompt?.step === 'place' ? (
                          <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
                            <div className="mt-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                              {t({ it: 'Clicca sul rack per posizionare', en: 'Click the rack to place' })}
                            </div>
                          </div>
                        ) : null}
                        {filteredRackItems.map(itemCard)}
                        {contextMenu ? (
                          <div
                            className="absolute z-10 w-36 rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-card"
                            style={{
                              top: contextMenu.y - (rackRef.current?.getBoundingClientRect().top || 0),
                              left: contextMenu.x - (rackRef.current?.getBoundingClientRect().left || 0)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                if (readOnly) return;
                                setSelectedItemId(contextMenu.itemId);
                                setContextMenu(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                              title={t({ it: 'Seleziona', en: 'Select' })}
                            >
                              {t({ it: 'Seleziona', en: 'Select' })}
                            </button>
                            <button
                              onClick={() => {
                                const item = rackItems.find((entry) => entry.id === contextMenu.itemId);
                                if (item) openEditPrompt(item);
                                setContextMenu(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                              title={t({ it: 'Configura', en: 'Configure' })}
                            >
                              {t({ it: 'Configura', en: 'Configure' })}
                            </button>
                            <button
                              onClick={() => {
                                const item = rackItems.find((entry) => entry.id === contextMenu.itemId);
                                if (item) openClonePrompt(item);
                                setContextMenu(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                              title={t({ it: 'Clona', en: 'Clone' })}
                            >
                              {t({ it: 'Clona', en: 'Clone' })}
                            </button>
                            {(() => {
                              const item = rackItems.find((entry) => entry.id === contextMenu.itemId);
                              if (!item || !hasPorts(item)) return null;
                              return (
                                <button
                                  onClick={() => {
                                    setPortsModalItemId(item.id);
                                    setPortsModalShowConnections(false);
                                    window.setTimeout(() => setContextMenu(null), 0);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                                  title={t({ it: 'Porte', en: 'Ports' })}
                                >
                                  {t({ it: 'Porte', en: 'Ports' })}
                                </button>
                              );
                            })()}
                            <button
                              onClick={() => {
                                if (readOnly) return;
                                setContextMenu(null);
                                setDeletePrompt({ mode: 'single', itemId: contextMenu.itemId });
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-rose-600 hover:bg-rose-50"
                              title={t({ it: 'Elimina', en: 'Delete' })}
                            >
                              {t({ it: 'Elimina', en: 'Delete' })}
                            </button>
                            {(() => {
                              const item = rackItems.find((entry) => entry.id === contextMenu.itemId);
                                  const ip =
                                    item?.type === 'switch' || item?.type === 'router' || item?.type === 'firewall'
                                      ? item?.mgmtIp || ''
                                      : item?.type === 'server'
                                        ? item?.ip || ''
                                        : '';
                                  if (!ip) return null;
                                  const rawIp = normalizeIp(ip);
                                  return (
                                    <div className="mt-1 border-t border-slate-200 pt-1">
                                      <div className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">
                                        {t({ it: 'Vai', en: 'Go to' })}
                                      </div>
                                      <a
                                        href={`https://${rawIp}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-primary hover:bg-slate-50"
                                      >
                                        HTTPS
                                      </a>
                                      <a
                                        href={`http://${rawIp}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-primary hover:bg-slate-50"
                                      >
                                        HTTP
                                      </a>
                                    </div>
                                  );
                                })()}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Dettaglio apparato', en: 'Device details' })}</div>
                      {selectedItem && rackDisplayName ? (
                        <div className="mt-1 text-xs font-semibold text-sky-600">{rackDisplayName}</div>
                      ) : null}
                      {selectedItem && draft ? (
                        <div className="mt-2 space-y-2">
                          {!hasHostName(selectedItem.type) ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Nome', en: 'Name' })}
                              <input
                                ref={selectedNameRef}
                                value={draft.name}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          ) : null}
                          {selectedItem.type !== 'misc' && selectedItem.type !== 'passacavo' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Marca', en: 'Brand' })}
                                <input
                                  value={draft.brand}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Modello', en: 'Model' })}
                                <input
                                  value={draft.model}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                            </div>
                          ) : null}
                          {(selectedItem.type === 'switch' ||
                            selectedItem.type === 'router' ||
                            selectedItem.type === 'firewall' ||
                            selectedItem.type === 'server') ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Nome host', en: 'Host name' })}
                              <input
                                value={draft.hostName}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, hostName: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          ) : null}
                          {selectedItem.type === 'switch' || selectedItem.type === 'router' || selectedItem.type === 'firewall' ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'IP gestione', en: 'Management IP' })}
                              <input
                                value={draft.mgmtIp}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, mgmtIp: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                              {draft.mgmtIp.trim() ? (
                                <a
                                  href={toUrl(draft.mgmtIp)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex text-xs font-semibold text-primary hover:underline"
                                >
                                  {t({ it: 'Apri IP gestione', en: 'Open management IP' })}
                                </a>
                              ) : null}
                            </label>
                          ) : null}
                          {selectedItem.type === 'server' ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'IP address', en: 'IP address' })}
                              <input
                                value={draft.ip}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, ip: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                              {draft.ip.trim() ? (
                                <a
                                  href={toUrl(draft.ip)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex text-xs font-semibold text-primary hover:underline"
                                >
                                  {t({ it: 'Apri IP server', en: 'Open server IP' })}
                                </a>
                              ) : null}
                            </label>
                          ) : null}
                          {selectedItem.type === 'server' ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'DELL iDRAC IP', en: 'Dell iDRAC IP' })}
                              <input
                                value={draft.idracIp}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, idracIp: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                              {draft.idracIp.trim() ? (
                                <a
                                  href={toUrl(draft.idracIp)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex text-xs font-semibold text-primary hover:underline"
                                >
                                  {t({ it: 'Apri iDRAC', en: 'Open iDRAC' })}
                                </a>
                              ) : null}
                            </label>
                          ) : null}
                          {(selectedItem.type === 'switch' ||
                            selectedItem.type === 'router' ||
                            selectedItem.type === 'firewall' ||
                            selectedItem.type === 'server') ? (
                            <>
                              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={draft.dualPower}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, dualPower: e.target.checked } : prev))}
                                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                                />
                                {t({ it: 'Doppia alimentazione', en: 'Dual power supply' })}
                              </label>
                            </>
                          ) : null}
                          {selectedItem.type === 'server' ? (
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={draft.rails}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, rails: e.target.checked } : prev))}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                              />
                              {t({ it: 'Slitte', en: 'Rails' })}
                            </label>
                          ) : null}
                          {selectedItem.type === 'ups' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Data manutenzione', en: 'Maintenance date' })}
                                <input
                                  type="date"
                                  value={draft.maintenanceDate}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, maintenanceDate: e.target.value } : prev))}
                                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Cambio batterie', en: 'Battery change' })}
                                <input
                                  type="date"
                                  value={draft.batteryChangeDate}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, batteryChangeDate: e.target.value } : prev))}
                                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                            </div>
                          ) : null}
                          {selectedItem.type === 'power_strip' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Numero prese', en: 'Outlets' })}
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.outlets}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, outlets: Number(e.target.value) || 0 } : prev))}
                                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={draft.mainSwitch}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, mainSwitch: e.target.checked } : prev))}
                                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                                />
                                {t({ it: 'Interruttore generale', en: 'Main switch' })}
                              </label>
                            </div>
                          ) : null}
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={3}
                              value={draft.notes}
                              onChange={(e) => setDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Unità (U)', en: 'Units (U)' })}
                              <input
                                type="number"
                                min={1}
                                max={totalUnits}
                                value={draft.unitSize}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, unitSize: Number(e.target.value) || 1 } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Unità start', en: 'Start unit' })}
                              <input
                                type="number"
                                min={1}
                                max={totalUnits}
                                value={draft.unitStart}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, unitStart: Number(e.target.value) || 1 } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          {hasEth(selectedItem.type) ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {selectedItem.type === 'switch' ||
                              selectedItem.type === 'router' ||
                              selectedItem.type === 'firewall' ||
                              selectedItem.type === 'server'
                                ? t({ it: 'Porte rame', en: 'Ethernet ports' })
                                : t({ it: 'Numero porte', en: 'Ports count' })}
                              <input
                                type="number"
                                min={0}
                                value={draft.ethPorts}
                                onChange={(e) =>
                                  setDraft((prev) => {
                                    if (!prev) return prev;
                                    const nextEth = Number(e.target.value) || 0;
                                    return { ...prev, ethPorts: nextEth };
                                  })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          ) : null}
                          {hasFiber(selectedItem.type) ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {selectedItem.type === 'switch' ||
                              selectedItem.type === 'router' ||
                              selectedItem.type === 'firewall' ||
                              selectedItem.type === 'server'
                                ? t({ it: 'Porte fibra', en: 'Fiber ports' })
                                : t({ it: 'Numero porte', en: 'Ports count' })}
                              <input
                                type="number"
                                min={0}
                                value={draft.fiberPorts}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, fiberPorts: Number(e.target.value) || 0 } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          ) : null}
                          {hasPorts(selectedItem) ? (
                            <button
                              onClick={() => {
                                setPortsModalItemId(selectedItem.id);
                                setPortsModalShowConnections(false);
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              title={t({ it: 'Configurazione porte', en: 'Port configuration' })}
                            >
                              {t({ it: 'Configurazione porte', en: 'Port configuration' })}
                            </button>
                          ) : null}
                          <div className="flex items-center gap-2 pt-2">
                            <button
                              onClick={handleSaveItem}
                              disabled={readOnly}
                              className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${readOnly ? 'bg-slate-300' : 'bg-primary hover:bg-primary/90'}`}
                              title={t({ it: 'Salva apparato', en: 'Save device' })}
                            >
                              {t({ it: 'Salva apparato', en: 'Save device' })}
                            </button>
                            <button
                              onClick={() => selectedItem && openClonePrompt(selectedItem)}
                              disabled={readOnly}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              title={t({ it: 'Clona apparato', en: 'Clone device' })}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Copy size={14} />
                                {t({ it: 'Clona', en: 'Clone' })}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                if (readOnly) return;
                                deleteRackItem(plan.id, selectedItem.id);
                                setSelectedItemId(null);
                              }}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                              title={t({ it: 'Elimina apparato', en: 'Delete device' })}
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-slate-500">
                          {t({ it: 'Seleziona un apparato nel rack.', en: 'Select a device inside the rack.' })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {addPrompt?.step === 'units' ? (
                  <div
                    className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        e.preventDefault();
                        setAddPrompt(null);
                      }
                    }}
                  >
                    <div
                      className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                      aria-hidden="true"
                      onClick={() => setAddPrompt(null)}
                    />
                    <div
                      className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="modal-title">
                        {t({ it: 'Unità apparato', en: 'Device units' })}
                      </div>
                      {addPrompt ? (
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          {getTypeLabel(addPrompt.type)}
                        </div>
                      ) : null}
                      <div className="mt-2 text-sm text-slate-600">
                        {t({ it: 'Specifica quante unità U occupa questo apparato.', en: 'Choose how many rack units this device occupies.' })}
                      </div>
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Unità (U)', en: 'Units (U)' })}
                          <input
                            ref={addPromptFocusRef}
                            type="number"
                            min={1}
                            max={totalUnits}
                            value={addUnitSize}
                            onChange={(e) => setAddUnitSize(Math.max(1, Math.min(totalUnits, Number(e.target.value) || 1)))}
                            autoFocus
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          />
                        </label>
                      </div>
                      {addPrompt?.mode === 'clone' ? (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          {t({
                            it: 'Modifica hostname e IP prima di salvare il clone.',
                            en: 'Change hostname and IP before saving the clone.'
                          })}
                        </div>
                      ) : null}
                      {addPrompt?.mode === 'clone' && !hasHostName(addPrompt.type) ? (
                        <label className="mt-3 block text-sm font-medium text-slate-700">
                          {t({ it: 'Nome apparato', en: 'Device name' })}
                          <input
                            value={addDetails.name}
                            onChange={(e) => setAddDetails((prev) => ({ ...prev, name: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          />
                        </label>
                      ) : null}
                      {addPrompt?.type === 'switch' || addPrompt?.type === 'router' || addPrompt?.type === 'firewall' ? (
                        <div className="mt-4 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome host', en: 'Host name' })}
                            <input
                              value={addDetails.hostName}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, hostName: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={addDetails.brand}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, brand: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={addDetails.model}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, model: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'IP gestione', en: 'Management IP' })}
                            <input
                              value={addDetails.mgmtIp}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, mgmtIp: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Porte rame', en: 'Ethernet ports' })}
                              <input
                                type="number"
                                min={0}
                                value={addDetails.ethPorts}
                                onChange={(e) =>
                                  setAddDetails((prev) => ({ ...prev, ethPorts: Math.max(0, Number(e.target.value) || 0) }))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Porte fibra', en: 'Fiber ports' })}
                              <input
                                type="number"
                                min={0}
                                value={addDetails.fiberPorts}
                                onChange={(e) =>
                                  setAddDetails((prev) => ({ ...prev, fiberPorts: Math.max(0, Number(e.target.value) || 0) }))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={addDetails.dualPower}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, dualPower: e.target.checked }))}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            {t({ it: 'Doppia alimentazione', en: 'Dual power supply' })}
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {addPrompt?.type === 'server' ? (
                        <div className="mt-4 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome host', en: 'Host name' })}
                            <input
                              value={addDetails.hostName}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, hostName: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={addDetails.brand}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, brand: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={addDetails.model}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, model: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'IP address', en: 'IP address' })}
                            <input
                              value={addDetails.ip}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, ip: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'DELL iDRAC IP', en: 'Dell iDRAC IP' })}
                            <input
                              value={addDetails.idracIp}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, idracIp: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Porte rame', en: 'Ethernet ports' })}
                              <input
                                type="number"
                                min={0}
                                value={addDetails.ethPorts}
                                onChange={(e) =>
                                  setAddDetails((prev) => ({ ...prev, ethPorts: Math.max(0, Number(e.target.value) || 0) }))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Porte fibra', en: 'Fiber ports' })}
                              <input
                                type="number"
                                min={0}
                                value={addDetails.fiberPorts}
                                onChange={(e) =>
                                  setAddDetails((prev) => ({ ...prev, fiberPorts: Math.max(0, Number(e.target.value) || 0) }))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={addDetails.rails}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, rails: e.target.checked }))}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            {t({ it: 'Slitte', en: 'Rails' })}
                          </label>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={addDetails.dualPower}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, dualPower: e.target.checked }))}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            {t({ it: 'Doppia alimentazione', en: 'Dual power supply' })}
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {addPrompt?.type === 'patchpanel' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={addDetails.brand}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, brand: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={addDetails.model}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, model: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Numero porte', en: 'Ports count' })}
                            <input
                              type="number"
                              min={0}
                              value={addDetails.ethPorts}
                              onChange={(e) =>
                                setAddDetails((prev) => ({ ...prev, ethPorts: Math.max(0, Number(e.target.value) || 0) }))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {addPrompt?.type === 'optical_drawer' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={addDetails.brand}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, brand: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={addDetails.model}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, model: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Connettore fibra', en: 'Fiber connector' })}
                            <select
                              value={addDetails.connectorType}
                              onChange={(e) =>
                                setAddDetails((prev) => ({ ...prev, connectorType: e.target.value as 'SC' | 'LC' | 'ST' | 'FC' }))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            >
                              <option value="SC">SC</option>
                              <option value="LC">LC</option>
                              <option value="ST">ST</option>
                              <option value="FC">FC</option>
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Numero porte', en: 'Ports count' })}
                            <input
                              type="number"
                              min={0}
                              value={addDetails.fiberPorts}
                              onChange={(e) =>
                                setAddDetails((prev) => ({ ...prev, fiberPorts: Math.max(0, Number(e.target.value) || 0) }))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {addPrompt?.type === 'ups' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={addDetails.brand}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, brand: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={addDetails.model}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, model: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Data manutenzione', en: 'Maintenance date' })}
                              <input
                                type="date"
                                value={addDetails.maintenanceDate}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, maintenanceDate: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Cambio batterie', en: 'Battery change' })}
                              <input
                                type="date"
                                value={addDetails.batteryChangeDate}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, batteryChangeDate: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {addPrompt?.type === 'power_strip' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={addDetails.brand}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, brand: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={addDetails.model}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, model: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Numero prese', en: 'Outlets' })}
                              <input
                                type="number"
                                min={0}
                                value={addDetails.outlets}
                                onChange={(e) =>
                                  setAddDetails((prev) => ({ ...prev, outlets: Math.max(0, Number(e.target.value) || 0) }))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={addDetails.mainSwitch}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, mainSwitch: e.target.checked }))}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                              />
                              {t({ it: 'Interruttore generale', en: 'Main switch' })}
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {addPrompt?.type === 'misc' || addPrompt?.type === 'passacavo' ? (
                        <div className="mt-4 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome', en: 'Name' })}
                            <input
                              value={addDetails.name}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, name: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          onClick={() => setAddPrompt(null)}
                          className="btn-secondary"
                          title={t({ it: 'Annulla', en: 'Cancel' })}
                        >
                          {t({ it: 'Annulla', en: 'Cancel' })}
                        </button>
                        <button
                          onClick={handleConfirmAdd}
                          className="btn-primary"
                          title={addActionLabel}
                        >
                          {addActionLabel}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                <RackPromptModals {...props} />
                <RackPortsModal
                  open={!!portsModalItemId}
                  item={portsModalItem}
                  racks={plan.racks || []}
                  rackItems={allRackItems}
                  rackLinks={plan.rackLinks || []}
                  readOnly={readOnly}
                  initialConnectionsOpen={portsModalShowConnections}
                  useDialog={false}
                  onClose={() => {
                    setPortsModalItemId(null);
                    setPortsModalShowConnections(false);
                  }}
                  onAddLink={(payload) => addRackLink(plan.id, payload)}
                  onDeleteLink={(linkId) => deleteRackLink(plan.id, linkId)}
                  onRenamePort={handleRenamePort}
                  onSavePortNote={handleSavePortNote}
                />
              </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </>
  );
};
