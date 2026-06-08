// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
// Edit-item and delete-item prompt modals for the rack modal. Extracted verbatim
// from RackModalBody; receives the same prop bag via {...props}.
export const RackPromptModals = (props: any) => {
  const {
    deletePrompt,
    editDetails,
    editPrompt,
    editUnitSize,
    formatItemLabel,
    handleConfirmDelete,
    handleConfirmEdit,
    hasPorts,
    name,
    rackItems,
    setDeletePrompt,
    setEditDetails,
    setEditPrompt,
    setEditUnitSize,
    setPortsModalItemId,
    setPortsModalShowConnections,
    t,
    totalUnits
  } = props;
  return (
      <>
                {editPrompt && editDetails ? (
                  <div
                    className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        e.preventDefault();
                        setEditPrompt(null);
                      }
                    }}
                  >
                    <div
                      className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                      aria-hidden="true"
                      onClick={() => setEditPrompt(null)}
                    />
                    <div
                      className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="modal-title">
                        {t({ it: 'Configura apparato', en: 'Configure device' })}
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        {t({ it: 'Aggiorna i dati dell’apparato selezionato.', en: 'Update the selected device data.' })}
                      </div>
                      {(() => {
                        const item = rackItems.find((entry) => entry.id === editPrompt.itemId);
                        if (!item) return null;
                        const endUnit = item.unitStart + item.unitSize - 1;
                        return (
                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            {t({ it: `Unità: ${item.unitStart}-${endUnit}`, en: `Units: ${item.unitStart}-${endUnit}` })}
                          </div>
                        );
                      })()}
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Unità (U)', en: 'Units (U)' })}
                          <input
                            type="number"
                            min={1}
                            max={totalUnits}
                            value={editUnitSize}
                            onChange={(e) => setEditUnitSize(Math.max(1, Math.min(totalUnits, Number(e.target.value) || 1)))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          />
                        </label>
                      </div>
                      {editPrompt.type === 'switch' || editPrompt.type === 'router' || editPrompt.type === 'firewall' ? (
                        <div className="mt-4 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome host', en: 'Host name' })}
                            <input
                              value={editDetails.hostName}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, hostName: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={editDetails.brand}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={editDetails.model}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'IP gestione', en: 'Management IP' })}
                            <input
                              value={editDetails.mgmtIp}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, mgmtIp: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Porte rame', en: 'Ethernet ports' })}
                              <input
                                type="number"
                                min={0}
                                value={editDetails.ethPorts}
                                onChange={(e) =>
                                  setEditDetails((prev) => (prev ? { ...prev, ethPorts: Math.max(0, Number(e.target.value) || 0) } : prev))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Porte fibra', en: 'Fiber ports' })}
                              <input
                                type="number"
                                min={0}
                                value={editDetails.fiberPorts}
                                onChange={(e) =>
                                  setEditDetails((prev) => (prev ? { ...prev, fiberPorts: Math.max(0, Number(e.target.value) || 0) } : prev))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={editDetails.dualPower}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, dualPower: e.target.checked } : prev))}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            {t({ it: 'Doppia alimentazione', en: 'Dual power supply' })}
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {editPrompt.type === 'server' ? (
                        <div className="mt-4 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome host', en: 'Host name' })}
                            <input
                              value={editDetails.hostName}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, hostName: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={editDetails.brand}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={editDetails.model}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'IP address', en: 'IP address' })}
                            <input
                              value={editDetails.ip}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, ip: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'DELL iDRAC IP', en: 'Dell iDRAC IP' })}
                            <input
                              value={editDetails.idracIp}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, idracIp: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Porte rame', en: 'Ethernet ports' })}
                              <input
                                type="number"
                                min={0}
                                value={editDetails.ethPorts}
                                onChange={(e) =>
                                  setEditDetails((prev) => (prev ? { ...prev, ethPorts: Math.max(0, Number(e.target.value) || 0) } : prev))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Porte fibra', en: 'Fiber ports' })}
                              <input
                                type="number"
                                min={0}
                                value={editDetails.fiberPorts}
                                onChange={(e) =>
                                  setEditDetails((prev) => (prev ? { ...prev, fiberPorts: Math.max(0, Number(e.target.value) || 0) } : prev))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={editDetails.rails}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, rails: e.target.checked } : prev))}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            {t({ it: 'Slitte', en: 'Rails' })}
                          </label>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={editDetails.dualPower}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, dualPower: e.target.checked } : prev))}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            {t({ it: 'Doppia alimentazione', en: 'Dual power supply' })}
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {editPrompt.type === 'patchpanel' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={editDetails.brand}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={editDetails.model}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Numero porte', en: 'Ports count' })}
                            <input
                              type="number"
                              min={0}
                              value={editDetails.ethPorts}
                              onChange={(e) =>
                                setEditDetails((prev) => (prev ? { ...prev, ethPorts: Math.max(0, Number(e.target.value) || 0) } : prev))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {editPrompt.type === 'optical_drawer' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={editDetails.brand}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={editDetails.model}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Connettore fibra', en: 'Fiber connector' })}
                            <select
                              value={editDetails.connectorType}
                              onChange={(e) =>
                                setEditDetails((prev) =>
                                  prev ? { ...prev, connectorType: e.target.value as 'SC' | 'LC' | 'ST' | 'FC' } : prev
                                )
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
                              value={editDetails.fiberPorts}
                              onChange={(e) =>
                                setEditDetails((prev) => (prev ? { ...prev, fiberPorts: Math.max(0, Number(e.target.value) || 0) } : prev))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {editPrompt.type === 'ups' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={editDetails.brand}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={editDetails.model}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Data manutenzione', en: 'Maintenance date' })}
                              <input
                                type="date"
                                value={editDetails.maintenanceDate}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, maintenanceDate: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Cambio batterie', en: 'Battery change' })}
                              <input
                                type="date"
                                value={editDetails.batteryChangeDate}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, batteryChangeDate: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {editPrompt.type === 'power_strip' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={editDetails.brand}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={editDetails.model}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
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
                                value={editDetails.outlets}
                                onChange={(e) =>
                                  setEditDetails((prev) => (prev ? { ...prev, outlets: Math.max(0, Number(e.target.value) || 0) } : prev))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={editDetails.mainSwitch}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, mainSwitch: e.target.checked } : prev))}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                              />
                              {t({ it: 'Interruttore generale', en: 'Main switch' })}
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {editPrompt.type === 'misc' || editPrompt.type === 'passacavo' ? (
                        <div className="mt-4 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome', en: 'Name' })}
                            <input
                              value={editDetails.name}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      <div className="mt-4 flex justify-between gap-2">
                        {(() => {
                          const item = rackItems.find((entry) => entry.id === editPrompt.itemId);
                          if (!item || !hasPorts(item)) return <div />;
                          return (
                            <button
                              onClick={() => {
                                setPortsModalItemId(item.id);
                                setPortsModalShowConnections(false);
                                window.setTimeout(() => setEditPrompt(null), 0);
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              title={t({ it: 'Configurazione porte', en: 'Port configuration' })}
                            >
                              {t({ it: 'Configurazione porte', en: 'Port configuration' })}
                            </button>
                          );
                        })()}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditPrompt(null)}
                            className="btn-secondary"
                            title={t({ it: 'Annulla', en: 'Cancel' })}
                          >
                            {t({ it: 'Annulla', en: 'Cancel' })}
                          </button>
                          <button
                            onClick={handleConfirmEdit}
                            className="btn-primary"
                            title={t({ it: 'Salva', en: 'Save' })}
                          >
                            {t({ it: 'Salva', en: 'Save' })}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                {deletePrompt ? (
                  <div
                    className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        e.preventDefault();
                        setDeletePrompt(null);
                      }
                    }}
                  >
                    <div
                      className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                      aria-hidden="true"
                      onClick={() => setDeletePrompt(null)}
                    />
                    <div
                      className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="modal-title">
                        {t({ it: 'Conferma eliminazione', en: 'Confirm deletion' })}
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        {deletePrompt.mode === 'all'
                          ? t({
                              it: 'Vuoi eliminare tutti gli apparati dal rack?',
                              en: 'Do you want to delete all devices from the rack?'
                            })
                          : (() => {
                              const item = rackItems.find((entry) => entry.id === deletePrompt.itemId);
                              if (!item) return '';
                              return t({
                                it: `Vuoi eliminare l'oggetto: ${formatItemLabel(item)} dal rack?`,
                                en: `Do you want to remove: ${formatItemLabel(item)} from the rack?`
                              });
                            })()}
                      </div>
                      {deletePrompt.mode === 'all' ? (
                        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          {rackItems.length === 0 ? (
                            <div>{t({ it: 'Nessun apparato presente.', en: 'No devices found.' })}</div>
                          ) : (
                            rackItems.map((item) => (
                              <div key={item.id} className="py-0.5">
                                {formatItemLabel(item)}
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          onClick={() => setDeletePrompt(null)}
                          className="btn-secondary"
                          title={t({ it: 'Annulla', en: 'Cancel' })}
                        >
                          {t({ it: 'Annulla', en: 'Cancel' })}
                        </button>
                        <button
                          onClick={handleConfirmDelete}
                          className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                          title={t({ it: 'Elimina', en: 'Delete' })}
                        >
                          {t({ it: 'Elimina', en: 'Delete' })}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
      </>
  );
};
