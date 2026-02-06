import { Fragment, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, MousePointerClick, Search, FileDown, UploadCloud, KeyRound, Layers, History, Keyboard } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { shallow } from 'zustand/shallow';
import { useT } from '../../i18n/useT';
import { releaseHistory } from '../../version/history';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const HelpPanel = () => {
  const { helpOpen, closeHelp } = useUIStore((s) => ({ helpOpen: s.helpOpen, closeHelp: s.closeHelp }), shallow);
  const t = useT();
  const latestVersion = releaseHistory[0]?.version || '0.0.0';
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);

  const sections = useMemo(
    () => [
      { id: 'help-login', label: t({ it: 'Login & permessi', en: 'Login & permissions' }) },
      { id: 'help-navigation', label: t({ it: 'Navigazione & upload', en: 'Navigation & upload' }) },
      { id: 'help-objects', label: t({ it: 'Oggetti sulla mappa', en: 'Objects on the map' }) },
      { id: 'help-rooms', label: t({ it: 'Stanze logiche', en: 'Logical rooms' }) },
      { id: 'help-layers', label: t({ it: 'Livelli, griglia e collegamenti', en: 'Layers, grid and links' }) },
      { id: 'help-search', label: t({ it: 'Ricerca e highlight', en: 'Search & highlight' }) },
      { id: 'help-shortcuts', label: t({ it: 'Scorciatoie da tastiera', en: 'Keyboard shortcuts' }) },
      { id: 'help-views', label: t({ it: 'Viste & revisioni', en: 'Views & revisions' }) },
      { id: 'help-export', label: t({ it: 'Export PDF', en: 'PDF export' }) }
    ],
    [t]
  );

  const handleJump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      el.scrollIntoView();
    }
  };

  const handleExportPdf = async () => {
    if (exporting) return;
    const node = contentRef.current;
    if (!node) return;
    setExporting(true);
    try {
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const maxWidth = pageWidth - margin * 2;
      let cursorY = margin;
      const blocks = Array.from(node.querySelectorAll('[data-help-block]'));

      for (const block of blocks) {
        const canvas = await html2canvas(block as HTMLElement, { backgroundColor: '#ffffff', scale: 2 });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgWidth = maxWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const availableHeight = pageHeight - margin * 2;
        const scale = imgHeight > availableHeight ? availableHeight / imgHeight : 1;
        const renderWidth = imgWidth * scale;
        const renderHeight = imgHeight * scale;
        const x = margin + (maxWidth - renderWidth) / 2;

        if (cursorY + renderHeight > pageHeight - margin) {
          pdf.addPage();
          cursorY = margin;
        }
        pdf.addImage(imgData, 'JPEG', x, cursorY, renderWidth, renderHeight);
        cursorY += renderHeight + 12;
      }

      pdf.save(`deskly_quick_help_v${latestVersion}.pdf`);
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  };

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
              <Dialog.Panel className="w-full max-w-xl modal-panel">
                <div className="modal-header items-center">
                  <div>
                    <Dialog.Title className="modal-title">
                      {t({ it: 'Aiuto rapido', en: 'Quick help' })}
                    </Dialog.Title>
                    <div className="text-xs font-semibold text-slate-500">v{latestVersion}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportPdf}
                      disabled={exporting}
                      className="btn-inline h-8 gap-1 px-2"
                      title={t({ it: 'Scarica quick help in PDF', en: 'Download quick help as PDF' })}
                    >
                      <FileDown size={14} />
                      PDF
                    </button>
                    <button onClick={closeHelp} className="icon-button" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => handleJump(section.id)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
                <div ref={contentRef} className="mt-4 space-y-4 text-sm text-slate-700">
                  <div data-help-block className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
                    {t({ it: 'Quick help — versione', en: 'Quick help — version' })} v{latestVersion}
                  </div>
                  <div data-help-block id="help-login" className="rounded-xl bg-mist p-3">
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
                          it: 'Se perdi l’app Authenticator, un admin può resettare l’MFA da Settings → Users.',
                          en: 'If you lose the Authenticator app, an admin can reset MFA from Settings → Users.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Troppi tentativi di accesso errati bloccano temporaneamente l’account.',
                          en: 'Too many failed login attempts temporarily lock the account.'
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
                  <div data-help-block id="help-navigation" className="rounded-xl bg-mist p-3">
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
                          it: 'Tasto destro su un cliente: puoi aprire Info cliente e Note cliente (note formattate con testo, immagini e tabelle).',
                          en: 'Right-click a client: you can open Client info and Client notes (formatted notes with text, images and tables).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Upload sicuri: immagini JPG/PNG/WEBP e PDF con limiti di dimensione.',
                          en: 'Safe uploads: JPG/PNG/WEBP images and PDFs with size limits.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Note cliente: per modificare una tabella posiziona il cursore in una cella e usa i pulsanti “+ Riga/+ Col”. Per ridimensionare un’immagine cliccala e scegli la percentuale. Puoi anche esportare le note in PDF.',
                          en: 'Client notes: to edit a table place the cursor in a cell and use the “+ Row/+ Col” buttons. To resize an image click it and choose a percentage. You can also export notes to PDF.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Ridimensionamento immagini: clicca un’immagine per selezionarla, poi trascina i pallini agli angoli (stile Word).',
                          en: 'Image resizing: click an image to select it, then drag the corner handles (Word-like).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Link nelle note: per aprire un link senza uscire dall’editor usa Ctrl/Cmd+click sul collegamento.',
                          en: 'Links in notes: to open a link without leaving the editor, use Ctrl/Cmd+click on it.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Nella modale Note cliente puoi anche gestire gli allegati PDF del cliente e vedere l’ultimo salvataggio. Se chiudi con modifiche non salvate viene chiesta conferma.',
                          en: 'In the Client notes modal you can also manage the client PDF attachments and see the last saved info. If you close with unsaved changes, you will be prompted.'
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
                  <div data-help-block id="help-objects" className="rounded-xl bg-mist p-3">
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
                          it: 'Quando scegli un oggetto da inserire, l’anteprima segue il mouse: clicca per piazzarlo.',
                          en: 'When you pick an object to place, a live preview follows the mouse: click to place it.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Utente reale: se configurato l’import, puoi trascinare “Utente reale” e scegliere il dipendente da una lista (con ricerca e filtro “solo non assegnati”).',
                          en: 'Real user: if import is configured, you can drag “Real user” and pick an employee from a searchable list (with “only unassigned” filter).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Alla creazione inserisci nome (obbligatorio; tranne immagini/foto/quote) e descrizione (opzionale).',
                          en: 'On creation, enter a name (required; except images/photos/quotes) and a description (optional).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Foto: l’oggetto mostra un’icona; doppio click per aprire la foto. Con più foto selezionate si apre la galleria con download.',
                          en: 'Photos: the object shows an icon; double click to open the photo. With multiple photos selected, a gallery opens with download.'
                        })}
                      </li>
                      <li>{t({ it: 'Tasto destro su un oggetto: modifica/duplica/scala/elimina.', en: 'Right-click an object: edit/duplicate/scale/delete.' })}</li>
                      <li>
                        {t({
                          it: 'Scrivanie: selezionale per allungare/allargare con i punti del riquadro.',
                          en: 'Desks: select them and use the handles to stretch/resize.'
                        })}
                      </li>
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
                      <li>
                        {t({
                          it: 'Ctrl/⌘ + freccia sinistra/destra: ruota le scrivanie selezionate di 90°.',
                          en: 'Ctrl/⌘ + left/right arrow: rotate selected desks by 90°.'
                        })}
                      </li>
                    </ul>
                  </div>
                  <div data-help-block id="help-rooms" className="rounded-xl bg-mist p-3">
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

                  <div data-help-block id="help-layers" className="rounded-xl bg-mist p-3">
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
                          it: 'CCTV: le telecamere mostrano il cono di visione; da menu oggetto regoli angolo, raggio e rotazione.',
                          en: 'CCTV: cameras show a view cone; use the object menu to adjust angle, range and rotation.'
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
                  <div data-help-block id="help-search" className="rounded-xl bg-mist p-3">
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
                  <div data-help-block id="help-shortcuts" className="rounded-xl bg-mist p-3">
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
                          it: 'Touchpad: due dita per spostare la mappa, pinch per zoom. In alternativa usa l’icona mano per trascinare con il tasto sinistro.',
                          en: 'Touchpad: two fingers to pan, pinch to zoom. Alternatively use the hand icon to drag with left click.'
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
                          it: '+ / −: aumenta o riduce la scala degli oggetti selezionati (per il testo cambia la dimensione del font).',
                          en: '+ / −: increase or decrease the scale of selected objects (for text it changes font size).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Ctrl/Cmd + ←/→: ruota di 90° gli oggetti che supportano la rotazione.',
                          en: 'Ctrl/Cmd + ←/→: rotate by 90° the objects that support rotation.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'F: cambia il font del testo selezionato.',
                          en: 'F: change the font of the selected text.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Shift+B: torna al font precedente del testo selezionato.',
                          en: 'Shift+B: previous font for the selected text.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'C: cambia colore del testo selezionato (Shift+C colore precedente).',
                          en: 'C: change selected text color (Shift+C previous color).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'B: mostra o nasconde il background del testo selezionato.',
                          en: 'B: toggle background for the selected text.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'L: collega 2 oggetti selezionati (se compatibili).',
                          en: 'L: link 2 selected objects (if compatible).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'N: rinomina l’oggetto selezionato (se ha un nome).',
                          en: 'N: rename the selected object (if it has a name).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Ctrl+R / Cmd+R: apre la rubrica utenti importati del cliente corrente (se disponibile).',
                          en: 'Ctrl+R / Cmd+R: opens the current client user directory (if available).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Rubrica utenti: Frecce per navigare e Cmd+M per aprire l’email selezionata.',
                          en: 'User directory: use arrows to navigate and Cmd+M to open the selected email.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'IP Map: Frecce per navigare e U per aprire l’URL selezionato.',
                          en: 'IP Map: use arrows to navigate and U to open the selected URL.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Ctrl+S / Cmd+S: salva un aggiornamento rapido (minor automatico).',
                          en: 'Ctrl+S / Cmd+S: saves a quick update (automatic minor).'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Ctrl+Z / Cmd+Z: annulla l’ultimo inserimento (con conferma).',
                          en: 'Ctrl+Z / Cmd+Z: undo last placement (with confirmation).'
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
                      <li>
                        {t({
                          it: 'W: avvia il disegno muro; premi di nuovo W (o doppio click) per chiudere.',
                          en: 'W: start wall drawing; press W again (or double click) to finish.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Shift (durante il disegno muro): vincola le linee a segmenti dritti.',
                          en: 'Shift (while drawing walls): constrain to straight segments.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'M: avvia la misura distanza; premi di nuovo M per interrompere.',
                          en: 'M: start measuring distance; press M again to stop.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Q: avvia la quota fissa; clicca due punti per creare una quota.',
                          en: 'Q: start a fixed quote; click two points to create a quote.'
                        })}
                      </li>
                      <li>
                        {t({
                          it: 'Scala: nella finestra di impostazione puoi premere Invio per salvare.',
                          en: 'Scale: in the set-scale dialog you can press Enter to save.'
                        })}
                      </li>
                    </ul>
                  </div>
                  <div data-help-block id="help-views" className="rounded-xl bg-mist p-3">
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
                  <div data-help-block id="help-export" className="rounded-xl bg-mist p-3">
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
