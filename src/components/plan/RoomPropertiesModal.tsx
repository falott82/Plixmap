import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Copy, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { IosSwitch } from './RoomModal.helpers';

type Translate = (msg: { it: string; en: string }) => string;

export type RoomPropertiesModalProps = {
  propertiesModalOpen: boolean;
  open: boolean;
  setPropertiesModalOpen: (value: boolean) => void;
  name: string;
  initialName: string;
  kioskLink: string;
  kioskRoomId?: string;
  kioskQrDataUrl: string;
  showName: boolean;
  setShowName: (v: boolean) => void;
  logical: boolean;
  setLogical: (v: boolean) => void;
  meetingRoom: boolean;
  setMeetingRoom: (v: boolean) => void;
  meetingProjector: boolean;
  setMeetingProjector: (v: boolean) => void;
  meetingTv: boolean;
  setMeetingTv: (v: boolean) => void;
  meetingVideoConf: boolean;
  setMeetingVideoConf: (v: boolean) => void;
  meetingCoffeeService: boolean;
  setMeetingCoffeeService: (v: boolean) => void;
  meetingWhiteboard: boolean;
  setMeetingWhiteboard: (v: boolean) => void;
  meetingKioskEnabled: boolean;
  setMeetingKioskEnabled: (v: boolean) => void;
  noWindows: boolean;
  setNoWindows: (v: boolean) => void;
  wifiAvailable: boolean;
  setWifiAvailable: (v: boolean) => void;
  fridgeAvailable: boolean;
  setFridgeAvailable: (v: boolean) => void;
  storageRoom: boolean;
  setStorageRoom: (v: boolean) => void;
  bathroom: boolean;
  setBathroom: (v: boolean) => void;
  technicalRoom: boolean;
  setTechnicalRoom: (v: boolean) => void;
  t: Translate;
};

/**
 * Room properties modal: visibility, exclusive room-type toggles (logical /
 * meeting / storage / bathroom / technical) and meeting amenities incl. the
 * kiosk public link. Extracted from RoomModal.tsx.
 */
export const RoomPropertiesModal = ({
  propertiesModalOpen,
  open,
  setPropertiesModalOpen,
  name,
  initialName,
  kioskLink,
  kioskRoomId,
  kioskQrDataUrl,
  showName,
  setShowName,
  logical,
  setLogical,
  meetingRoom,
  setMeetingRoom,
  meetingProjector,
  setMeetingProjector,
  meetingTv,
  setMeetingTv,
  meetingVideoConf,
  setMeetingVideoConf,
  meetingCoffeeService,
  setMeetingCoffeeService,
  meetingWhiteboard,
  setMeetingWhiteboard,
  meetingKioskEnabled,
  setMeetingKioskEnabled,
  noWindows,
  setNoWindows,
  wifiAvailable,
  setWifiAvailable,
  fridgeAvailable,
  setFridgeAvailable,
  storageRoom,
  setStorageRoom,
  bathroom,
  setBathroom,
  technicalRoom,
  setTechnicalRoom,
  t
}: RoomPropertiesModalProps) => (
      <Transition show={propertiesModalOpen && open} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setPropertiesModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl modal-panel">
                  <div className="modal-header items-center">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Proprietà stanza', en: 'Room properties' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({ it: 'Stanza', en: 'Room' })}: <span className="font-semibold text-slate-700">{name.trim() || initialName || '-'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setPropertiesModalOpen(false)}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 space-y-2">
                    <IosSwitch
                      label={t({ it: 'Nome visibile in mappa', en: 'Show name on map' })}
                      description={t({
                        it: 'Mostra il nome della stanza direttamente sulla planimetria.',
                        en: 'Displays the room name directly on the floor plan.'
                      })}
                      checked={showName}
                      onChange={setShowName}
                    />
                    <IosSwitch
                      label={t({ it: 'Room logica', en: 'Logical room' })}
                      description={t({
                        it: "Opzione esclusiva: disattiva meeting room e tipologie stanza speciali.",
                        en: 'Exclusive option: disables meeting room and special room types.'
                      })}
                      checked={logical}
                      disabled={meetingRoom || storageRoom || bathroom || technicalRoom}
                      onChange={(next) => {
                        setLogical(next);
                        if (next) {
                          setMeetingRoom(false);
                          setMeetingProjector(false);
                          setMeetingTv(false);
                          setMeetingVideoConf(false);
                          setMeetingCoffeeService(false);
                          setMeetingWhiteboard(false);
                          setMeetingKioskEnabled(false);
                          setNoWindows(false);
                          setWifiAvailable(false);
                          setFridgeAvailable(false);
                          setStorageRoom(false);
                          setBathroom(false);
                          setTechnicalRoom(false);
                        }
                      }}
                    />
                    <IosSwitch
                      label={t({ it: 'Meeting room', en: 'Meeting room' })}
                      description={t({
                        it: 'Esclusa dalla ricerca collocazione salvo opzione dedicata.',
                        en: 'Excluded from placement search unless explicitly enabled.'
                      })}
                      checked={meetingRoom}
                      disabled={logical || storageRoom || bathroom || technicalRoom}
                      onChange={(next) => {
                        setMeetingRoom(next);
                        if (next) {
                          setLogical(false);
                          setStorageRoom(false);
                          setBathroom(false);
                          setTechnicalRoom(false);
                        } else {
                          setMeetingProjector(false);
                          setMeetingTv(false);
                          setMeetingVideoConf(false);
                          setMeetingCoffeeService(false);
                          setMeetingWhiteboard(false);
                          setMeetingKioskEnabled(false);
                          setWifiAvailable(false);
                          setFridgeAvailable(false);
                        }
                      }}
                    />
                    {meetingRoom ? (
                      <div className="ml-4 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2">
                        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                          {t({ it: 'Dotazioni meeting room', en: 'Meeting room equipment' })}
                        </div>
                        <IosSwitch
                          label={t({ it: 'Proiettore', en: 'Projector' })}
                          checked={meetingProjector}
                          onChange={setMeetingProjector}
                        />
                        <IosSwitch
                          label="TV"
                          checked={meetingTv}
                          onChange={setMeetingTv}
                        />
                        <IosSwitch
                          label={t({ it: 'Sistema di videoconferenza autonomo', en: 'Autonomous video conference system' })}
                          checked={meetingVideoConf}
                          onChange={setMeetingVideoConf}
                        />
                        <IosSwitch
                          label={t({ it: 'Coffee service', en: 'Coffee service' })}
                          checked={meetingCoffeeService}
                          onChange={setMeetingCoffeeService}
                        />
                        <IosSwitch
                          label={t({ it: 'Lavagna', en: 'Whiteboard' })}
                          checked={meetingWhiteboard}
                          onChange={setMeetingWhiteboard}
                        />
                        <IosSwitch
                          label={t({ it: 'Guest Wifi', en: 'Guest Wifi' })}
                          checked={wifiAvailable}
                          onChange={setWifiAvailable}
                        />
                        <IosSwitch
                          label={t({ it: 'Frigo', en: 'Fridge' })}
                          checked={fridgeAvailable}
                          onChange={setFridgeAvailable}
                        />
                        <IosSwitch
                          label={t({ it: 'Kiosk mode', en: 'Kiosk mode' })}
                          description={t({
                            it: 'Abilita link e QR code per aprire il pannello kiosk su tablet.',
                            en: 'Enables link and QR code to open the kiosk panel on a tablet.'
                          })}
                          checked={meetingKioskEnabled}
                          onChange={setMeetingKioskEnabled}
                        />
                        {meetingKioskEnabled ? (
                          kioskRoomId ? (
                            <div className="rounded-xl border border-emerald-200 bg-white p-3">
                              <div className="text-xs font-semibold text-emerald-700">
                                {t({ it: 'Accesso kiosk mode', en: 'Kiosk mode access' })}
                              </div>
                              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
                                {kioskQrDataUrl ? (
                                  <img
                                    src={kioskQrDataUrl}
                                    alt={t({ it: 'QR code kiosk', en: 'Kiosk QR code' })}
                                    className="h-28 w-28 rounded-lg border border-slate-200 bg-white p-1"
                                  />
                                ) : (
                                  <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[11px] text-slate-500">
                                    QR
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[11px]">
                                    <div className="truncate font-mono text-slate-700">{kioskLink}</div>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (typeof window !== 'undefined' && kioskLink) {
                                          window.open(kioskLink, '_blank', 'noopener,noreferrer');
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                    >
                                      <ExternalLink size={13} />
                                      {t({ it: 'Apri link', en: 'Open link' })}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!navigator?.clipboard?.writeText) {
                                          toast.error(t({ it: 'Clipboard non disponibile', en: 'Clipboard not available' }));
                                          return;
                                        }
                                        navigator.clipboard.writeText(kioskLink)
                                          .then(() => toast.success(t({ it: 'Link kiosk copiato', en: 'Kiosk link copied' })))
                                          .catch(() => toast.error(t({ it: 'Copia non riuscita', en: 'Copy failed' })));
                                      }}
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      <Copy size={13} />
                                      {t({ it: 'Copia link', en: 'Copy link' })}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                              {t({
                                it: 'Salva la stanza per generare link e QR code kiosk.',
                                en: 'Save the room to generate kiosk link and QR code.'
                              })}
                            </div>
                          )
                        ) : null}
                      </div>
                    ) : null}
                    <IosSwitch
                      label={t({ it: 'Stanza senza finestre', en: 'Room without windows' })}
                      checked={noWindows}
                      disabled={logical}
                      onChange={(next) => {
                        if (logical && next) return;
                        setNoWindows(next);
                      }}
                    />
                    <IosSwitch
                      label={t({ it: 'Ripostiglio', en: 'Storage room' })}
                      description={t({
                        it: 'Non occupabile da utenti e utenti reali.',
                        en: 'Users and real users cannot be placed here.'
                      })}
                      checked={storageRoom}
                      disabled={meetingRoom || logical || bathroom || technicalRoom}
                      onChange={(next) => {
                        setStorageRoom(next);
                        if (next) {
                          setLogical(false);
                          setMeetingRoom(false);
                          setMeetingProjector(false);
                          setMeetingTv(false);
                          setMeetingVideoConf(false);
                          setMeetingCoffeeService(false);
                          setMeetingWhiteboard(false);
                          setMeetingKioskEnabled(false);
                          setWifiAvailable(false);
                          setFridgeAvailable(false);
                          setBathroom(false);
                          setTechnicalRoom(false);
                        }
                      }}
                    />
                    <IosSwitch
                      label={t({ it: 'Bagno', en: 'Bathroom' })}
                      description={t({
                        it: 'Non occupabile da utenti e utenti reali.',
                        en: 'Users and real users cannot be placed here.'
                      })}
                      checked={bathroom}
                      disabled={meetingRoom || logical || storageRoom || technicalRoom}
                      onChange={(next) => {
                        setBathroom(next);
                        if (next) {
                          setLogical(false);
                          setMeetingRoom(false);
                          setMeetingProjector(false);
                          setMeetingTv(false);
                          setMeetingVideoConf(false);
                          setMeetingCoffeeService(false);
                          setMeetingWhiteboard(false);
                          setMeetingKioskEnabled(false);
                          setWifiAvailable(false);
                          setFridgeAvailable(false);
                          setStorageRoom(false);
                          setTechnicalRoom(false);
                        }
                      }}
                    />
                    <IosSwitch
                      label={t({ it: 'Locale tecnico', en: 'Technical room' })}
                      description={t({
                        it: 'Non occupabile da utenti e utenti reali.',
                        en: 'Users and real users cannot be placed here.'
                      })}
                      checked={technicalRoom}
                      disabled={meetingRoom || logical || storageRoom || bathroom}
                      onChange={(next) => {
                        setTechnicalRoom(next);
                        if (next) {
                          setLogical(false);
                          setMeetingRoom(false);
                          setMeetingProjector(false);
                          setMeetingTv(false);
                          setMeetingVideoConf(false);
                          setMeetingCoffeeService(false);
                          setMeetingWhiteboard(false);
                          setMeetingKioskEnabled(false);
                          setWifiAvailable(false);
                          setFridgeAvailable(false);
                          setStorageRoom(false);
                          setBathroom(false);
                        }
                      }}
                    />
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPropertiesModalOpen(false)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
);
