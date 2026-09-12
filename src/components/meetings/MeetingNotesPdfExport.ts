/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from 'jspdf';
import { getMeetingSchedulePhase, getMeetingSchedulePhaseLabel } from '../../utils/meetingTime';
import {
  normalizePdfText,
  wrapPdfTextToWidth,
  fetchImageAsDataUrl,
  sanitizeFileName,
  normalizePdfNoteText,
  formatStamp,
  normalizeActionProgress,
  formatIsoDayLabel
} from './MeetingNotesModal.helpers';

// PDF report generation extracted from MeetingNotesModal (verbatim body). Side
// effects (toast/setState/modal close) are injected via deps.
export const exportMeetingNotesPdf = async (deps: any) => {
  const {
    meeting,
    managerFields,
    selectedNotesForPdf,
    invitedParticipants,
    followUpChain,
    reportActions,
    reportNextMeeting,
    actionInsights,
    selectedClient,
    selectedSite,
    selectedFloorPlan,
    pdfFileName,
    push,
    t,
    setPdfExporting,
    setPdfReviewModalOpen,
    setPdfSelectionModalOpen,
    setError
  } = deps;
    if (!meeting?.id) return;
    setPdfExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 38;
      const footerReserved = 32;
      const contentWidth = pageWidth - margin * 2;
      const contentBottom = pageHeight - margin - footerReserved;
      let y = margin;

      const clientName = String(selectedClient?.name || meeting.clientId || '-');
      const siteName = String(selectedSite?.name || meeting.siteId || '-');
      const floorPlanName = String(selectedFloorPlan?.name || meeting.floorPlanId || '-');
      const roomName = String(meeting.roomName || '-');
      const meetingStart = Number(meeting.startAt || 0);
      const meetingEnd = Number(meeting.endAt || 0);
      const meetingDate = new Date(meetingStart).toLocaleDateString();
      const meetingTime = `${new Date(meetingStart).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })} - ${new Date(meetingEnd).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })}`;
      const clientLogoUrl = String((selectedClient as any)?.logoUrl || '').trim();
      const clientLogoData = await fetchImageAsDataUrl(clientLogoUrl);

      const addPage = () => {
        doc.addPage();
        y = margin;
      };
      const ensureSpace = (needed: number) => {
        if (y + needed <= contentBottom) return;
        addPage();
      };
      const drawSectionTitle = (title: string, subtitle?: string) => {
        ensureSpace(subtitle ? 36 : 24);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(title, margin, y + 11);
        if (subtitle) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(subtitle, margin, y + 24);
          y += 32;
          return;
        }
        y += 20;
      };

      const drawHeader = () => {
        const h = 118;
        ensureSpace(h + 10);
        doc.setFillColor(30, 64, 175);
        doc.roundedRect(margin, y, contentWidth, h, 12, 12, 'F');
        doc.setTextColor(248, 250, 252);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(t({ it: 'Report meeting manager', en: 'Meeting manager report' }), margin + 16, y + 24);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`${clientName} • ${siteName} • ${floorPlanName}`, margin + 16, y + 44);
        doc.text(`${roomName} • ${meetingDate} • ${meetingTime}`, margin + 16, y + 60);
        doc.text(
          `${t({ it: 'Riunione', en: 'Meeting' })}: ${String(meeting.subject || t({ it: 'Senza oggetto', en: 'Untitled' }))}`,
          margin + 16,
          y + 76
        );
        doc.text(
          `${t({ it: 'Appunti inclusi', en: 'Included notes' })}: ${selectedNotesForPdf.length} • ${t({ it: 'Task', en: 'Tasks' })}: ${reportActions.length}`,
          margin + 16,
          y + 92
        );
        if (clientLogoData) {
          try {
            doc.addImage(clientLogoData, 'PNG', margin + contentWidth - 64, y + 14, 48, 48, undefined, 'FAST');
          } catch {
            // ignore invalid image
          }
        }
        y += h + 12;
      };

      const drawParticipantsTwoColumns = () => {
        drawSectionTitle(
          t({ it: 'Partecipanti', en: 'Participants' }),
          `${invitedParticipants.length} ${t({ it: 'invitati', en: 'invited' })}`
        );
        if (!invitedParticipants.length) {
          ensureSpace(18);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text(t({ it: 'Nessun partecipante disponibile', en: 'No participants available' }), margin, y + 10);
          y += 18;
          return;
        }
        const tableGap = 12;
        const colWidth = (contentWidth - tableGap) / 2;
        const leftRows = Math.ceil(invitedParticipants.length / 2);
        for (let rowIdx = 0; rowIdx < leftRows; rowIdx += 1) {
          const left = invitedParticipants[rowIdx] || null;
          const right = invitedParticipants[rowIdx + leftRows] || null;
          const formatCell = (person: (typeof invitedParticipants)[number] | null) => {
            if (!person) return ['—'];
            const main = `${String(person.name || '').trim()} (${person.remote ? 'remote' : 'on site'})`;
            const secondary = person.kind === 'internal' ? String(person.department || '').trim() : String(person.company || '').trim();
            const text = secondary ? `${main} • ${secondary}` : main;
            return wrapPdfTextToWidth(doc, text, colWidth - 14);
          };
          const leftLines = formatCell(left);
          const rightLines = formatCell(right);
          const maxLines = Math.max(leftLines.length, rightLines.length, 1);
          const rowHeight = 8 + maxLines * 11;
          if (y + rowHeight > contentBottom) {
            addPage();
          }
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentWidth, rowHeight, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.rect(margin, y, contentWidth, rowHeight);
          doc.line(margin + colWidth + tableGap / 2, y, margin + colWidth + tableGap / 2, y + rowHeight);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(15, 23, 42);
          leftLines.forEach((line, idx) => doc.text(line, margin + 8, y + 12 + idx * 11));
          rightLines.forEach((line, idx) => doc.text(line, margin + colWidth + tableGap / 2 + 8, y + 12 + idx * 11));
          y += rowHeight;
        }
        y += 10;
      };

      const drawFollowUpChainSection = () => {
        const hasFollowUpParent = !!String((meeting as any)?.followUpOfMeetingId || '').trim();
        if (!hasFollowUpParent && followUpChain.length <= 1) return;
        const chainRows = [...followUpChain].sort((a, b) => Number(a.meeting.startAt || 0) - Number(b.meeting.startAt || 0));
        if (!chainRows.length) return;
        drawSectionTitle(
          t({ it: 'Chain follow-up', en: 'Follow-up chain' }),
          `${chainRows.length} ${t({ it: 'meeting collegati', en: 'linked meetings' })}`
        );
        const colStep = 42;
        const colDate = 116;
        const colStatus = 76;
        const colSubject = contentWidth - colStep - colDate - colStatus - 16;
        const drawHeaderRow = () => {
          ensureSpace(22);
          doc.setFillColor(241, 245, 249);
          doc.rect(margin, y, contentWidth, 20, 'F');
          doc.setDrawColor(203, 213, 225);
          doc.rect(margin, y, contentWidth, 20);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text('#', margin + 6, y + 13);
          doc.text(t({ it: 'Data', en: 'Date' }), margin + colStep + 6, y + 13);
          doc.text(t({ it: 'Stato', en: 'Status' }), margin + colStep + colDate + 6, y + 13);
          doc.text(t({ it: 'Riunione', en: 'Meeting' }), margin + colStep + colDate + colStatus + 6, y + 13);
          y += 20;
        };
        drawHeaderRow();
        for (let index = 0; index < chainRows.length; index += 1) {
          const row = chainRows[index];
          const startAt = Number(row.meeting.startAt || 0);
          const endAt = Number(row.meeting.endAt || 0);
          const now = Date.now();
          const phase = getMeetingSchedulePhase(startAt, endAt, now);
          const phaseLabel = getMeetingSchedulePhaseLabel(phase, t, {
            past: { it: 'Passato', en: 'Past' }
          });
          const fill =
            phase === 'past'
              ? ([241, 245, 249] as const)
              : phase === 'current'
                ? ([220, 252, 231] as const)
                : ([224, 242, 254] as const);
          const meetingLabel = `${String(row.meeting.subject || t({ it: 'Riunione', en: 'Meeting' }))} • ${String(row.meeting.roomName || '-')}`;
          const meetingLines = wrapPdfTextToWidth(doc, meetingLabel, colSubject - 10);
          const rowHeight = Math.max(20, 8 + meetingLines.length * 11);
          if (y + rowHeight > contentBottom) {
            addPage();
            drawHeaderRow();
          }
          doc.setFillColor(fill[0], fill[1], fill[2]);
          doc.rect(margin, y, contentWidth, rowHeight, 'F');
          doc.setDrawColor(203, 213, 225);
          doc.rect(margin, y, contentWidth, rowHeight);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          doc.text(String(index + 1).padStart(2, '0'), margin + 6, y + 13);
          doc.setFont('helvetica', 'normal');
          doc.text(new Date(startAt).toLocaleDateString(), margin + colStep + 6, y + 13);
          doc.text(phaseLabel, margin + colStep + colDate + 6, y + 13);
          meetingLines.forEach((line, idx) => doc.text(line, margin + colStep + colDate + colStatus + 6, y + 13 + idx * 11));
          y += rowHeight;
        }
        y += 10;
      };

      const drawReportSummary = () => {
        const topics = normalizePdfText(String(managerFields.topicsText || '')) || '—';
        const summary = normalizePdfText(String(managerFields.summaryText || '')) || '—';
        drawSectionTitle(t({ it: 'Temi e sommario', en: 'Topics and summary' }));

        const drawCard = (label: string, value: string, tone?: 'green') => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          const labelLines = wrapPdfTextToWidth(doc, label, contentWidth - 24);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          const valueLines = wrapPdfTextToWidth(doc, value, contentWidth - 24);
          const height = 14 + labelLines.length * 10 + valueLines.length * 11;
          ensureSpace(height + 6);
          if (tone === 'green') {
            doc.setFillColor(220, 252, 231);
          } else {
            doc.setFillColor(248, 250, 252);
          }
          doc.roundedRect(margin, y, contentWidth, height, 8, 8, 'F');
          let cursor = y + 12;
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(tone === 'green' ? 6 : 71, tone === 'green' ? 95 : 85, tone === 'green' ? 70 : 105);
          labelLines.forEach((line) => {
            doc.text(line, margin + 10, cursor);
            cursor += 10;
          });
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(tone === 'green' ? 6 : 15, tone === 'green' ? 95 : 23, tone === 'green' ? 70 : 42);
          valueLines.forEach((line) => {
            doc.text(line, margin + 10, cursor + 1);
            cursor += 11;
          });
          y += height + 6;
        };

        drawCard(t({ it: 'Temi trattati', en: 'Topics discussed' }), topics);
        drawCard(t({ it: 'Sommario generale', en: 'General summary' }), summary);
        drawCard(t({ it: 'Prossima riunione', en: 'Next meeting' }), reportNextMeeting.value, 'green');
      };

      const drawActionsSection = () => {
        drawSectionTitle(
          t({ it: 'Azioni meeting', en: 'Meeting actions' }),
          `${reportActions.length} ${t({ it: 'azioni totali', en: 'total actions' })}`
        );
        if (!reportActions.length) {
          ensureSpace(18);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text(t({ it: 'Nessuna azione disponibile', en: 'No actions available' }), margin, y + 10);
          y += 18;
          return;
        }
        const colTask = contentWidth * 0.34;
        const colOwner = contentWidth * 0.2;
        const colDates = contentWidth * 0.2;
        const colStatus = contentWidth - colTask - colOwner - colDates;
        const drawHeaderRow = () => {
          ensureSpace(22);
          doc.setFillColor(241, 245, 249);
          doc.rect(margin, y, contentWidth, 20, 'F');
          doc.setDrawColor(203, 213, 225);
          doc.rect(margin, y, contentWidth, 20);
          doc.line(margin + colTask, y, margin + colTask, y + 20);
          doc.line(margin + colTask + colOwner, y, margin + colTask + colOwner, y + 20);
          doc.line(margin + colTask + colOwner + colDates, y, margin + colTask + colOwner + colDates, y + 20);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text(t({ it: 'Task', en: 'Task' }), margin + 8, y + 13);
          doc.text(t({ it: 'Assegnata a', en: 'Assigned to' }), margin + colTask + 8, y + 13);
          doc.text(t({ it: 'Date', en: 'Dates' }), margin + colTask + colOwner + 8, y + 13);
          doc.text(t({ it: 'Stato', en: 'Status' }), margin + colTask + colOwner + colDates + 8, y + 13);
          y += 20;
        };
        drawHeaderRow();

        for (const row of reportActions) {
          const progress = normalizeActionProgress(Number(row.progressPct || 0));
          const isNotNeeded = String(row.status || '') === 'not_needed';
          const isDone = !isNotNeeded && progress >= 100;
          const tone = isNotNeeded ? ([241, 245, 249] as const) : isDone ? ([220, 252, 231] as const) : ([254, 249, 195] as const);
          const taskLabel = String(row.action || '').trim() || '—';
          const ownerLabel = String(row.assignedTo || '').trim() || '—';
          const dateLabel = `${formatIsoDayLabel(String(row.openingDate || ''))} -> ${formatIsoDayLabel(String(row.completionDate || ''))}`;
          const statusLabel = isNotNeeded
            ? `${t({ it: 'Non necessaria', en: 'Not needed' })} (N/A)`
            : isDone
              ? `${t({ it: 'Completata', en: 'Completed' })} (100%)`
              : `${t({ it: 'In corso', en: 'In progress' })} (${progress}%)`;
          const taskLines = wrapPdfTextToWidth(doc, taskLabel, colTask - 16);
          const ownerLines = wrapPdfTextToWidth(doc, ownerLabel, colOwner - 16);
          const dateLines = wrapPdfTextToWidth(doc, dateLabel, colDates - 16);
          const statusLines = wrapPdfTextToWidth(doc, statusLabel, colStatus - 16);
          const maxLines = Math.max(taskLines.length, ownerLines.length, dateLines.length, statusLines.length, 1);
          const rowHeight = 8 + maxLines * 11;
          if (y + rowHeight > contentBottom) {
            addPage();
            drawHeaderRow();
          }
          doc.setFillColor(tone[0], tone[1], tone[2]);
          doc.rect(margin, y, contentWidth, rowHeight, 'F');
          doc.setDrawColor(203, 213, 225);
          doc.rect(margin, y, contentWidth, rowHeight);
          doc.line(margin + colTask, y, margin + colTask, y + rowHeight);
          doc.line(margin + colTask + colOwner, y, margin + colTask + colOwner, y + rowHeight);
          doc.line(margin + colTask + colOwner + colDates, y, margin + colTask + colOwner + colDates, y + rowHeight);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(15, 23, 42);
          taskLines.forEach((line, idx) => doc.text(line, margin + 8, y + 12 + idx * 11));
          ownerLines.forEach((line, idx) => doc.text(line, margin + colTask + 8, y + 12 + idx * 11));
          dateLines.forEach((line, idx) => doc.text(line, margin + colTask + colOwner + 8, y + 12 + idx * 11));
          statusLines.forEach((line, idx) => doc.text(line, margin + colTask + colOwner + colDates + 8, y + 12 + idx * 11));
          y += rowHeight;
        }
        y += 10;
      };

      const drawNotesSection = () => {
        drawSectionTitle(t({ it: 'Appunti selezionati', en: 'Selected notes' }));
        if (!selectedNotesForPdf.length) {
          ensureSpace(20);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text(t({ it: 'Nessun appunto incluso nel report.', en: 'No notes included in the report.' }), margin, y + 10);
          y += 20;
          return;
        }
        for (let index = 0; index < selectedNotesForPdf.length; index += 1) {
          const note = selectedNotesForPdf[index];
          const noteTitle = String(note.title || t({ it: 'Appunto meeting', en: 'Meeting note' })).trim();
          const author = String(note.authorDisplayName || note.authorUsername || '-').trim();
          const noteText = normalizePdfNoteText(String(note.contentHtml || note.contentText || '').trim());
          const lines = wrapPdfTextToWidth(doc, noteText, contentWidth - 24);

          let cursor = 0;
          let firstChunk = true;
          while (cursor < lines.length || firstChunk) {
            if (firstChunk) {
              ensureSpace(38);
              doc.setFillColor(224, 242, 254);
              doc.roundedRect(margin, y, contentWidth, 30, 8, 8, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(10);
              doc.setTextColor(3, 105, 161);
              doc.text(`${index + 1}. ${noteTitle}`, margin + 8, y + 13);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(14, 116, 144);
              doc.text(`${author} • ${formatStamp(Number(note.updatedAt || 0))}`, margin + 8, y + 24);
              y += 36;
              firstChunk = false;
            }
            const available = contentBottom - y;
            const maxLinesPerChunk = Math.max(1, Math.floor((Math.max(available, 32) - 14) / 10));
            const chunk = lines.slice(cursor, cursor + maxLinesPerChunk);
            const textHeight = Math.max(24, 10 + chunk.length * 10);
            if (y + textHeight + 8 > contentBottom) {
              addPage();
              continue;
            }
            const textTop = y;
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(margin, textTop, contentWidth, textHeight, 8, 8, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 41, 59);
            chunk.forEach((line, lineIndex) => {
              doc.text(line, margin + 10, textTop + 12 + lineIndex * 10);
            });
            y = textTop + textHeight + 8;
            cursor += chunk.length;
            if (cursor < lines.length) addPage();
          }
        }
      };

      const drawChartsAndStats = () => {
        drawSectionTitle(t({ it: 'Grafici e statistiche', en: 'Charts and statistics' }));
        const total = Math.max(1, actionInsights.total);
        const doneW = Math.round((contentWidth * actionInsights.done) / total);
        const inProgressW = Math.round((contentWidth * actionInsights.inProgress) / total);
        const notNeededW = Math.max(0, contentWidth - doneW - inProgressW);
        ensureSpace(104);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(t({ it: 'Mix completamento', en: 'Completion mix' }), margin, y + 10);
        doc.setFillColor(22, 163, 74);
        doc.rect(margin, y + 16, doneW, 14, 'F');
        doc.setFillColor(245, 158, 11);
        doc.rect(margin + doneW, y + 16, inProgressW, 14, 'F');
        doc.setFillColor(148, 163, 184);
        doc.rect(margin + doneW + inProgressW, y + 16, notNeededW, 14, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(margin, y + 16, contentWidth, 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(`${t({ it: 'Completate', en: 'Completed' })}: ${actionInsights.done}`, margin, y + 40);
        doc.text(`${t({ it: 'In corso', en: 'In progress' })}: ${actionInsights.inProgress}`, margin + 150, y + 40);
        doc.text(`${t({ it: 'Non necessarie', en: 'Not needed' })}: ${actionInsights.notNeeded}`, margin + 300, y + 40);

        const statBoxWidth = (contentWidth - 18) / 4;
        const stats = [
          { label: t({ it: 'Tasso completamento', en: 'Completion rate' }), value: `${actionInsights.completionRate}%` },
          { label: t({ it: 'Tempo medio risoluzione', en: 'Avg resolution' }), value: `${actionInsights.avgResolutionDays || 0}d` },
          { label: t({ it: 'In ritardo', en: 'Overdue' }), value: String(actionInsights.overdue) },
          { label: t({ it: 'Totale task', en: 'Total tasks' }), value: String(actionInsights.total) }
        ];
        let boxX = margin;
        for (const stat of stats) {
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(boxX, y + 52, statBoxWidth, 38, 6, 6, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text(stat.label, boxX + 6, y + 65);
          doc.setFontSize(12);
          doc.setTextColor(30, 41, 59);
          doc.text(stat.value, boxX + 6, y + 82);
          boxX += statBoxWidth + 6;
        }
        y += 98;

        const progressRows = reportActions.map((row: any, index: number) => {
          const progress = normalizeActionProgress(Number(row.progressPct || 0));
          const isNotNeeded = String(row.status || '') === 'not_needed';
          const isDone = !isNotNeeded && progress >= 100;
          const color = isNotNeeded ? ([148, 163, 184] as const) : isDone ? ([22, 163, 74] as const) : ([245, 158, 11] as const);
          return {
            id: `pdf-progress-${index}`,
            label: String(row.action || '').trim() || `${t({ it: 'Task', en: 'Task' })} ${index + 1}`,
            progress: isNotNeeded ? 100 : progress,
            isNotNeeded,
            color
          };
        });
        for (const item of progressRows) {
          ensureSpace(28);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          doc.text(item.label, margin, y + 8);
          doc.text(item.isNotNeeded ? 'N/A' : `${item.progress}%`, margin + contentWidth, y + 8, { align: 'right' });
          doc.setFillColor(226, 232, 240);
          doc.roundedRect(margin, y + 12, contentWidth, 8, 4, 4, 'F');
          doc.setFillColor(item.color[0], item.color[1], item.color[2]);
          doc.roundedRect(margin, y + 12, Math.max(0, Math.min(contentWidth, (contentWidth * item.progress) / 100)), 8, 4, 4, 'F');
          y += 26;
        }
      };

      drawHeader();
      drawParticipantsTwoColumns();
      drawFollowUpChainSection();
      drawReportSummary();
      drawActionsSection();
      drawNotesSection();
      drawChartsAndStats();

      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`${clientName} • ${siteName} • ${roomName}`, margin, pageHeight - 10);
        doc.text(`${page}/${pages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      }

      const finalFileName = sanitizeFileName(
        pdfFileName,
        `Meeting-${String(meeting?.subject || t({ it: 'Riunione', en: 'Meeting' })).trim()}`
      );
      doc.save(finalFileName);
      setPdfReviewModalOpen(false);
      setPdfSelectionModalOpen(false);
      push(t({ it: 'PDF generato', en: 'PDF generated' }), 'success');
    } catch (e: any) {
      const message = String(e?.message || 'Unable to export notes PDF');
      setError(message);
      push(message, 'danger');
    } finally {
      setPdfExporting(false);
    }
};
