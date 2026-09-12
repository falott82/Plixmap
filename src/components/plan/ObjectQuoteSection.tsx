/* eslint-disable @typescript-eslint/no-explicit-any */
type Translate = (msg: { it: string; en: string }) => string;

export type ObjectQuoteSectionProps = {
  quoteColor: string;
  quoteDashed: boolean;
  quoteEndpoint: any;
  quoteLabelBg: any;
  quoteLabelColor: string;
  quoteLabelOffset: number;
  quoteLabelPosEffective: any;
  quoteLabelScale: number;
  quoteLengthLabel: any;
  quoteOrientation: any;
  readOnly: boolean;
  scale: number;
  setQuoteColor: (v: any) => void;
  setQuoteDashed: (v: any) => void;
  setQuoteEndpoint: (v: any) => void;
  setQuoteLabelBg: (v: any) => void;
  setQuoteLabelColor: (v: any) => void;
  setQuoteLabelOffset: (v: any) => void;
  setQuoteLabelPos: (v: any) => void;
  setQuoteLabelScale: (v: any) => void;
  setScale: (v: any) => void;
  t: Translate;
};

/**
 * Quote/measurement object configuration section of the object modal (color,
 * dash, endpoints, label position/scale/colors, preview). Extracted from
 * ObjectModal.tsx.
 */
export const ObjectQuoteSection = ({
  quoteColor,
  quoteDashed,
  quoteEndpoint,
  quoteLabelBg,
  quoteLabelColor,
  quoteLabelOffset,
  quoteLabelPosEffective,
  quoteLabelScale,
  quoteLengthLabel,
  quoteOrientation,
  readOnly,
  scale,
  setQuoteColor,
  setQuoteDashed,
  setQuoteEndpoint,
  setQuoteLabelBg,
  setQuoteLabelColor,
  setQuoteLabelOffset,
  setQuoteLabelPos,
  setQuoteLabelScale,
  setScale,
  t
}: ObjectQuoteSectionProps) => {
  const quotePreview = (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs font-semibold text-slate-600">{t({ it: 'Anteprima', en: 'Preview' })}</div>
      <div className="mt-2">
        {quoteOrientation === 'vertical' ? (
          <svg viewBox="0 0 220 240" className="h-40 w-full">
            <line
              x1="110"
              y1="30"
              x2="110"
              y2="210"
              stroke={quoteColor}
              strokeWidth={2 * scale}
              strokeDasharray={quoteDashed ? '6 5' : undefined}
            />
            {quoteEndpoint === 'dots' ? (
              <>
                <circle cx="110" cy="30" r="4" fill={quoteColor} />
                <circle cx="110" cy="210" r="4" fill={quoteColor} />
              </>
            ) : null}
            {quoteEndpoint === 'arrows' ? (
              <>
                <polygon points="110,18 100,34 120,34" fill={quoteColor} />
                <polygon points="110,222 100,206 120,206" fill={quoteColor} />
              </>
            ) : null}
            <text
              x={
                quoteLabelPosEffective === 'left'
                  ? 110 - 30 * quoteLabelOffset
                  : quoteLabelPosEffective === 'right'
                    ? 110 + 30 * quoteLabelOffset
                    : 110
              }
              y={120}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10 * quoteLabelScale}
              fontWeight="bold"
              fill={quoteLabelColor}
              transform={`rotate(-90 ${
                quoteLabelPosEffective === 'left'
                  ? 110 - 30 * quoteLabelOffset
                  : quoteLabelPosEffective === 'right'
                    ? 110 + 30 * quoteLabelOffset
                    : 110
              } 120)`}
            >
              {quoteLengthLabel || '0'}
            </text>
          </svg>
        ) : (
          <svg viewBox="0 0 320 160" className="h-32 w-full">
            <line
              x1="40"
              y1="80"
              x2="280"
              y2="80"
              stroke={quoteColor}
              strokeWidth={2 * scale}
              strokeDasharray={quoteDashed ? '6 5' : undefined}
            />
            {quoteEndpoint === 'dots' ? (
              <>
                <circle cx="40" cy="80" r="4" fill={quoteColor} />
                <circle cx="280" cy="80" r="4" fill={quoteColor} />
              </>
            ) : null}
            {quoteEndpoint === 'arrows' ? (
              <>
                <polygon points="34,80 48,70 48,90" fill={quoteColor} />
                <polygon points="286,80 272,70 272,90" fill={quoteColor} />
              </>
            ) : null}
            <text
              x={160}
              y={
                quoteLabelPosEffective === 'above'
                  ? 80 - 10 * quoteLabelOffset
                  : quoteLabelPosEffective === 'below'
                    ? 80 + 10 * quoteLabelOffset
                    : 80
              }
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10 * quoteLabelScale}
              fontWeight="bold"
              fill={quoteLabelColor}
            >
              {quoteLengthLabel || '0'}
            </text>
          </svg>
        )}
      </div>
    </div>
  );
  return (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                        <span>{t({ it: 'Opzioni quota', en: 'Quote options' })}</span>
                        {quoteLengthLabel ? (
                          <span className="text-xs font-mono text-slate-500">{quoteLengthLabel}</span>
                        ) : null}
                      </div>
                      <div className={`mt-3 ${quoteOrientation === 'vertical' ? 'flex gap-3' : 'grid gap-3'}`}>
                        <div className={quoteOrientation === 'vertical' ? 'grid flex-1 gap-3' : 'grid gap-3'}>
                          <div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              {t({ it: 'Scala linea', en: 'Line scale' })}
                              <span className="ml-auto text-xs font-mono text-slate-500 tabular-nums">{scale.toFixed(2)}</span>
                            </div>
                            <input
                              type="range"
                              min={0.5}
                              max={1.6}
                              step={0.05}
                              value={scale}
                              disabled={readOnly}
                              onChange={(e) => setScale(Number(e.target.value))}
                              className="mt-1 w-full"
                            />
                          </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            {t({ it: 'Scala etichetta', en: 'Label scale' })}
                            <span className="ml-auto text-xs font-mono text-slate-500 tabular-nums">{quoteLabelScale.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={0.6}
                            max={2}
                            step={0.05}
                            value={quoteLabelScale}
                            disabled={readOnly}
                            onChange={(e) => setQuoteLabelScale(Number(e.target.value))}
                            className="mt-1 w-full"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            {t({ it: 'Distanza scritta', en: 'Label distance' })}
                            <span className="ml-auto text-xs font-mono text-slate-500 tabular-nums">{quoteLabelOffset.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={0.5}
                            max={2}
                            step={0.05}
                            value={quoteLabelOffset}
                            disabled={readOnly}
                            onChange={(e) => {
                              setQuoteLabelOffset(Number(e.target.value));
                            }}
                            className="mt-1 w-full"
                          />
                        </div>
                        <label className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                          <span>{t({ it: 'Background etichetta', en: 'Label background' })}</span>
                          <input
                            type="checkbox"
                              checked={quoteLabelBg}
                              disabled={readOnly}
                              onChange={(e) => setQuoteLabelBg(e.target.checked)}
                            />
                          </label>
                          <div>
                            <label className="text-xs font-semibold text-slate-600">
                              {t({ it: 'Posizione scritta', en: 'Label position' })}
                            </label>
                            <select
                            value={quoteLabelPosEffective}
                            disabled={readOnly}
                            onChange={(e) => setQuoteLabelPos(e.target.value as any)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                          >
                              {quoteOrientation === 'vertical' ? (
                                <>
                                  <option value="left">{t({ it: 'Sinistra', en: 'Left' })}</option>
                                  <option value="center">{t({ it: 'Centro', en: 'Center' })}</option>
                                  <option value="right">{t({ it: 'Destra', en: 'Right' })}</option>
                                </>
                              ) : (
                                <>
                                  <option value="above">{t({ it: 'Sopra', en: 'Above' })}</option>
                                  <option value="center">{t({ it: 'Centro', en: 'Center' })}</option>
                                  <option value="below">{t({ it: 'Sotto', en: 'Below' })}</option>
                                </>
                              )}
                            </select>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <input
                                type="checkbox"
                                checked={quoteDashed}
                                disabled={readOnly}
                                onChange={(e) => setQuoteDashed(e.target.checked)}
                              />
                              {t({ it: 'Tratteggio', en: 'Dashed' })}
                            </label>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <span>{t({ it: 'Apici', en: 'Endpoints' })}</span>
                              <select
                                value={quoteEndpoint}
                                disabled={readOnly}
                                onChange={(e) => setQuoteEndpoint(e.target.value as any)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                              >
                                <option value="arrows">{t({ it: 'Frecce', en: 'Arrows' })}</option>
                                <option value="dots">{t({ it: 'Puntini', en: 'Dots' })}</option>
                                <option value="none">{t({ it: 'Nessuno', en: 'None' })}</option>
                              </select>
                            </div>
                          </div>
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                          <span>{t({ it: 'Colore linea', en: 'Line color' })}</span>
                          <input
                            type="color"
                            value={quoteColor}
                            disabled={readOnly}
                            onChange={(e) => setQuoteColor(e.target.value)}
                            className="h-7 w-9 rounded border border-slate-200 bg-white"
                            title={t({ it: 'Colore linea', en: 'Line color' })}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                          <span>{t({ it: 'Colore testo', en: 'Text color' })}</span>
                          <input
                            type="color"
                            value={quoteLabelColor}
                            disabled={readOnly}
                            onChange={(e) => setQuoteLabelColor(e.target.value)}
                            className="h-7 w-9 rounded border border-slate-200 bg-white"
                            title={t({ it: 'Colore testo', en: 'Text color' })}
                          />
                        </div>
                        </div>
                        {quoteOrientation === 'vertical' ? <div className="w-44">{quotePreview}</div> : quotePreview}
                          </div>
                        </div>
  );
};
