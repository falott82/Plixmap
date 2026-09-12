import { Fragment, type MutableRefObject } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

type Translate = (msg: { it: string; en: string }) => string;

type ClientMeetingsPreviewData = {
  clientName: string;
  siteName: string;
  planName: string;
  viewBox: string;
  planImageUrl?: string;
  planWidth: number;
  planHeight: number;
  planImageX?: number;
  planImageY?: number;
  roomId?: string;
  rooms: any[];
};

export type SidebarClientMeetingsRoomPreviewModalProps = {
  clientMeetingsRoomPreview: unknown;
  clientMeetingsRoomPreviewFocusRef: MutableRefObject<HTMLButtonElement | null>;
  setClientMeetingsRoomPreview: (value: null) => void;
  clientMeetingsPreviewData: ClientMeetingsPreviewData | null;
  t: Translate;
};

/**
 * Read-only floor-plan preview of a meeting room, opened from the client
 * meetings timeline. Extracted from SidebarTree.tsx.
 */
export const SidebarClientMeetingsRoomPreviewModal = ({
  clientMeetingsRoomPreview,
  clientMeetingsRoomPreviewFocusRef,
  setClientMeetingsRoomPreview,
  clientMeetingsPreviewData,
  t
}: SidebarClientMeetingsRoomPreviewModalProps) => (
  <Transition show={!!clientMeetingsRoomPreview} as={Fragment}>
    <Dialog
      as="div"
      className="relative z-[96]"
      initialFocus={clientMeetingsRoomPreviewFocusRef}
      onClose={() => setClientMeetingsRoomPreview(null)}
    >
      <Transition.Child
        as={Fragment}
        enter="ease-out duration-150"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm" />
      </Transition.Child>
      <div className="fixed inset-0 overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
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
                    {clientMeetingsPreviewData
                      ? `${clientMeetingsPreviewData.clientName} > ${clientMeetingsPreviewData.siteName} > ${clientMeetingsPreviewData.planName}`
                      : t({ it: 'Dati non disponibili', en: 'Data not available' })}
                  </div>
                </div>
                <button
                  ref={clientMeetingsRoomPreviewFocusRef}
                  type="button"
                  onClick={() => setClientMeetingsRoomPreview(null)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-3">
                {clientMeetingsPreviewData ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <svg viewBox={clientMeetingsPreviewData.viewBox} className="h-[58vh] w-full rounded-lg bg-white">
                      {clientMeetingsPreviewData.planImageUrl &&
                      clientMeetingsPreviewData.planWidth > 0 &&
                      clientMeetingsPreviewData.planHeight > 0 ? (
                        <image
                          href={clientMeetingsPreviewData.planImageUrl}
                          xlinkHref={clientMeetingsPreviewData.planImageUrl}
                          x={clientMeetingsPreviewData.planImageX || 0}
                          y={clientMeetingsPreviewData.planImageY || 0}
                          width={clientMeetingsPreviewData.planWidth}
                          height={clientMeetingsPreviewData.planHeight}
                          preserveAspectRatio="none"
                          opacity={0.9}
                        />
                      ) : null}
                      {clientMeetingsPreviewData.rooms.map((room: any) => {
                        const points = room.points.map((p: any) => `${p.x},${p.y}`).join(' ');
                        const selected = room.id === clientMeetingsPreviewData.roomId;
                        const roomFill = selected
                          ? 'rgba(34,197,94,0.35)'
                          : room.meetingRoom
                            ? 'rgba(14,165,233,0.14)'
                            : 'rgba(255,255,255,0)';
                        const roomStroke = selected ? '#16a34a' : room.meetingRoom ? '#0284c7' : '#94a3b8';
                        return (
                          <g key={room.id}>
                            <polygon points={points} fill={roomFill} stroke={roomStroke} strokeWidth={selected ? 2 : 1.1} />
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
