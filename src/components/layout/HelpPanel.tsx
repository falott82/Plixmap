import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, MousePointerClick, Search, FileDown, UploadCloud, KeyRound, Layers, History, Keyboard } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { shallow } from 'zustand/shallow';
import { useT } from '../../i18n/useT';

const HelpPanel = () => {
  const { helpOpen, closeHelp } = useUIStore((s) => ({ helpOpen: s.helpOpen, closeHelp: s.closeHelp }), shallow);
  const t = useT();

  return (
    <Transition show={helpOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeHelp}>
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
          <div className="flex min-h-full items-end justify-end px-4 py-8">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-4"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-4"
            >
              <Dialog.Panel className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-start justify-between">
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {t({ it: 'Aiuto rapido', en: 'Quick help' })}
                  </Dialog.Title>
                  <button onClick={closeHelp} className="text-slate-500 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-4 space-y-4 text-sm text-slate-700">
                  <div className="rounded-xl bg-mist p-3">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <KeyRound size={16} /> {t({ it: 'Login & permessi', en: 'Login & permissions' })}
                    </div>
                    <ul className="ml-5 list-disc space-y-1 pt-2">
                      <li>{t({ it: 'Per accedere serve un account (admin o utente).', en: 'Access requires an account (admin or user).' })}</li>
                      <li>
                        {t({
                          it: 'Al primo accesso del superadmin viene richiesto di cambiare password e scegliere la lingua.',
                          en: 'On the superadmin’s first login, you must change the password and choose the language.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'MFA (opzionale): dal tuo Account puoi attivare/disattivare il codice TOTP (app Authenticator).',
                          en: 'MFA (optional): from your Account you can enable/disable TOTP codes (Authenticator app).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'I permessi possono essere assegnati per Cliente/Sede/Planimetria in sola lettura o lettura+scrittura.',
                          en: 'Permissions can be assigned per Client/Site/Floor plan in read-only or read+write.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'In sola lettura puoi cercare, interrogare e esportare, ma non modificare.',
                          en: 'In read-only you can search, inspect and export, but you cannot modify.'
                        })}
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl bg-mist p-3">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <UploadCloud size={16} /> {t({ it: 'Navigazione & upload', en: 'Navigation & upload' })}
                    </div>
                    <ul className="ml-5 list-disc space-y-1 pt-2">
                      <li>
                        {t({
                          it: 'Sidebar: Cliente → Sede → Planimetria. Clic per aprire la vista.',
                          en: 'Sidebar: Client → Site → Floor plan. Click to open.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Tasto destro su una planimetria: puoi impostarla come preferita per il tuo utente (stellina) o aprire la Time machine.',
                          en: 'Right-click a floor plan: you can set it as your favorite (star) or open the Time machine.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Se un altro utente sta modificando la stessa planimetria, viene applicato un lock: tu la vedrai in sola lettura finché non viene sbloccata.',
                          en: 'If another user is editing the same floor plan, an exclusive lock is applied: you will see it in read-only until it is released.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Impostazioni: gestisci clienti/sedi/planimetrie e carica l’immagine (solo admin).',
                          en: 'Settings: manage clients/sites/floor plans and upload the image (admin only).'
                        })}
                      </li>
                      <li>{t({ it: 'Il file caricato diventa lo sfondo della mappa.', en: 'The uploaded file becomes the map background.' })}</li>
                    </ul>
                  </div>
                  <div className="rounded-xl bg-mist p-3">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <MousePointerClick size={16} /> {t({ it: 'Oggetti sulla mappa', en: 'Objects on the map' })}
                    </div>
                    <ul className="ml-5 list-disc space-y-1 pt-2">
                      <li>
                        {t({
                          it: 'Trascina un’icona dalla palette sulla mappa (oppure usa Aggiungi dal menu destro).',
                          en: 'Drag an icon from the palette onto the map (or use Add from the right-click menu).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Utente reale: se configurato l’import, puoi trascinare “Utente reale” e scegliere il dipendente da una lista (con ricerca e filtro “solo non assegnati”).',
                          en: 'Real user: if import is configured, you can drag “Real user” and pick an employee from a searchable list (with “only unassigned” filter).'
                        })}
                      </li>
                      <li>{t({ it: 'Alla creazione inserisci nome (obbligatorio) e descrizione (opzionale).', en: 'On creation, enter a name (required) and a description (optional).' })}</li>
                      <li>{t({ it: 'Tasto destro su un oggetto: modifica/duplica/scala/elimina.', en: 'Right-click an object: edit/duplicate/scale/delete.' })}</li>
                      <li>{t({ it: 'Ctrl/⌘ click: selezione multipla. Del/Backspace: elimina con conferma.', en: 'Ctrl/⌘ click: multi-select. Del/Backspace: delete with confirmation.' })}</li>
                      <li>{t({ it: 'Shift + tasto destro (trascina): seleziona un’area e prende tutti gli oggetti dentro.', en: 'Shift + right mouse (drag): box-select an area and pick all objects inside.' })}</li>
                      <li>{t({ it: 'Con più oggetti selezionati: trascina il riquadro tratteggiato per spostarli “a blocco”.', en: 'With multiple objects selected: drag the dashed frame to move them as a group.' })}</li>
                      <li>{t({ it: 'Esc: annulla la selezione (oggetti o stanza).', en: 'Esc: clears the selection (objects or room).' })}</li>
                      <li>
                        {t({
                          it: 'Frecce tastiera: sposta lentamente gli oggetti selezionati (Shift per passi più grandi).',
                          en: 'Arrow keys: nudge selected objects (Shift for larger steps).'
                        })}
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl bg-mist p-3">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <Layers size={16} /> {t({ it: 'Stanze logiche', en: 'Logical rooms' })}
                    </div>
                    <ul className="ml-5 list-disc space-y-1 pt-2">
                      <li>
                        {t({
                          it: 'Crea una stanza: tasto destro sulla mappa → Nuova stanza → Rettangolo (oppure Poligono).',
                          en: 'Create a room: right-click on the map → New room → Rectangle (or Polygon).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Poligono: clicca più punti. Clicca sul primo punto (o premi Invio) per chiudere l’area. Backspace rimuove l’ultimo punto.',
                          en: 'Polygon: click multiple points. Click the first point (or press Enter) to close the area. Backspace removes the last point.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Gli oggetti dentro il rettangolo vengono collegati automaticamente alla stanza.',
                          en: 'Objects inside the rectangle are automatically linked to the room.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Puoi modificare il perimetro: seleziona la stanza e trascina i punti blu (poligono) oppure ridimensiona/sposta (rettangolo).',
                          en: 'You can edit the perimeter: select the room and drag the blue points (polygon) or resize/move it (rectangle).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Puoi spostare/ridimensionare la stanza; i collegamenti vengono aggiornati.',
                          en: 'You can move/resize the room; links are updated.'
                        })}
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-xl bg-mist p-3">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <Layers size={16} /> {t({ it: 'Livelli, griglia e collegamenti', en: 'Layers, grid and links' })}
                    </div>
                    <ul className="ml-5 list-disc space-y-1 pt-2">
                      <li>
                        {t({
                          it: 'Livelli: nella palette puoi attivare/disattivare i livelli per mostrare/nascondere gruppi di oggetti (es. Utenti, Dispositivi, Cablaggi).',
                          en: 'Layers: from the palette you can toggle layers to show/hide groups of objects (e.g. Users, Devices, Cabling).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Oggetto: nella modale puoi assegnare uno o più livelli; serve per filtrare la mappa.',
                          en: 'Object: in the modal you can assign one or more layers; it’s used to filter the map.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Griglia: puoi attivare “Snap” e/o “Mostra” per posizionamenti più precisi.',
                          en: 'Grid: enable “Snap” and/or “Show” for more precise placement.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Collegamenti: tasto destro su un oggetto → “Crea collegamento…” poi clicca un secondo oggetto. Canc per eliminare un collegamento selezionato.',
                          en: 'Links: right-click an object → “Create link” then click a second object. Delete removes the selected link.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Doppio clic su un collegamento: modifica nome/descrizione e stile (colore/spessore/tratteggio).',
                          en: 'Double-click a link: edit name/description and style (color/width/dashed).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Collegamenti: puoi creare un collegamento lineare o un collegamento a 90°. Tasto destro su un oggetto → “Crea collegamento” oppure “Crea collegamento 90°”, poi clicca un secondo oggetto.',
                          en: 'Links: you can create a straight link or a 90° link. Right-click an object → “Create link” or “Create 90° link”, then click a second object.'
                        })}
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl bg-mist p-3">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <Search size={16} /> {t({ it: 'Ricerca e highlight', en: 'Search & highlight' })}
                    </div>
                    <ul className="ml-5 list-disc space-y-1 pt-2">
                      <li>
                        {t({
                          it: 'Barra di ricerca nella vista planimetria: filtra per nome/descrizione.',
                          en: 'Search bar in the floor plan view: filters by name/description.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Puoi cercare anche una stanza per nome.',
                          en: 'You can also search rooms by name.'
                        })}
                      </li>
                      <li>{t({ it: 'Se trovato: l’oggetto viene evidenziato (blink/highlight) sulla mappa.', en: 'If found: the object is highlighted (blink) on the map.' })}</li>
                      <li>
                        {t({
                          it: 'Se trovi una stanza: lampeggia il perimetro della stanza.',
                          en: 'If a room is found: the room perimeter blinks.'
                        })}
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl bg-mist p-3">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <Keyboard size={16} /> {t({ it: 'Scorciatoie da tastiera', en: 'Keyboard shortcuts' })}
                    </div>
                    <ul className="ml-5 list-disc space-y-1 pt-2">
                      <li>
                        {t({
                          it: 'Ctrl+F (Windows/Linux) o Cmd+F (macOS): focus sulla ricerca nella planimetria corrente.',
                          en: 'Ctrl+F (Windows/Linux) or Cmd+F (macOS): focus the search input for the current floor plan.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Invio (nella ricerca): esegue la ricerca e fa lampeggiare l’elemento trovato.',
                          en: 'Enter (in search): runs the search and blinks the matched element.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Ctrl/Cmd + click: selezione multipla (toggle).',
                          en: 'Ctrl/Cmd + click: multi-select (toggle).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Trascina con il tasto sinistro su un’area vuota: selezione multipla con riquadro.',
                          en: 'Left-drag on an empty area: box-select multiple objects.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Pan mappa: tasto centrale del mouse oppure Cmd+click destro (macOS) / Alt+click destro (Windows/Linux).',
                          en: 'Pan: middle mouse button or Cmd+right-click (macOS) / Alt+right-click (Windows/Linux).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Frecce: spostamento fine degli oggetti selezionati (Shift = passo maggiore).',
                          en: 'Arrow keys: fine movement for selected objects (Shift = larger step).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Canc: elimina l’oggetto (o i multipli oggetti) selezionati dopo conferma.',
                          en: 'Delete: removes the selected object(s) after confirmation.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Ctrl+A (Windows/Linux) o Cmd+A (macOS): seleziona tutti gli oggetti della planimetria (i collegamenti tra gli oggetti selezionati vengono inclusi nella lista “Modifica selezione”).',
                          en: 'Ctrl+A (Windows/Linux) or Cmd+A (macOS): selects all objects in the floor plan (links between selected objects are included in the “Edit selection” list).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Esc: annulla selezione e chiude modali/menu.',
                          en: 'Esc: clears selection and closes modals/menus.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Stanze poligono: Backspace rimuove l’ultimo punto, Invio chiude l’area.',
                          en: 'Polygon rooms: Backspace removes the last point, Enter closes the area.'
                        })}
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl bg-mist p-3">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <History size={16} /> {t({ it: 'Viste & revisioni', en: 'Views & revisions' })}
                    </div>
                    <ul className="ml-5 list-disc space-y-1 pt-2">
                      <li>
                        {t({
                          it: 'Viste: salva zoom/pan e imposta una vista di default per la planimetria.',
                          en: 'Views: save zoom/pan and set a default view for the floor plan.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Revisioni (Time machine): salva uno storico immutabile e naviga nel tempo in sola lettura.',
                          en: 'Revisions (Time machine): save immutable history and browse it in read-only.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Confronta: dalla Time machine puoi selezionare 2 revisioni e confrontarle (A più nuova sopra, B più vecchia sotto).',
                          en: 'Compare: from the Time machine you can select 2 revisions and compare them (newer A on top, older B below).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Se cambi planimetria con modifiche non salvate, appare una modale: puoi salvare una revisione oppure cambiare senza salvare (le modifiche vengono annullate).',
                          en: 'If you switch floor plans with unsaved changes, a modal appears: you can save a revision or switch without saving (changes are discarded).'
                        })}
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl bg-mist p-3">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <FileDown size={16} /> {t({ it: 'Export PDF', en: 'PDF export' })}
                    </div>
                    <ul className="ml-5 list-disc space-y-1 pt-2">
                      <li>{t({ it: 'Usa “Esporta PDF” nella planimetria corrente.', en: 'Use “Export PDF” in the current floor plan.' })}</li>
                      <li>
                        {t({
                          it: 'Esporta la planimetria senza UI; puoi includere o escludere gli oggetti (default: inclusi).',
                          en: 'Exports the floor plan without UI; you can include or exclude objects (default: included).'
                        })}
                      </li>
                      <li>{t({ it: 'Dal changelog puoi anche esportare in PDF la history delle versioni.', en: 'From the changelog you can also export the version history to PDF.' })}</li>
                    </ul>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default HelpPanel;
