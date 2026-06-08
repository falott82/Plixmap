/* eslint-disable @typescript-eslint/no-explicit-any */
import { WIFI_RANGE_SCALE_MAX, WIFI_STANDARD_OPTIONS } from '../../store/data';

type Translate = (msg: { it: string; en: string }) => string;

export type ObjectWifiSectionProps = {
  wifiSource: any;
  wifiBrand: string;
  wifiModel: string;
  wifiModelCode: string;
  wifiStandard: string;
  wifiBand24: boolean;
  wifiBand5: boolean;
  wifiBand6: boolean;
  wifiCoverageSqm: string;
  wifiShowRange: boolean;
  wifiRangeScale: number;
  wifiCatalogId: string;
  wifiCoverageAreaSqm: number | null;
  wifiCoverageDiameter: number | null;
  wifiCoverageRadius: number | null;
  wifiEffectiveAreaSqm: number | null;
  wifiEffectiveDiameter: number | null;
  wifiEffectiveRadius: number | null;
  wifiFormValid: boolean;
  hasWifiCatalog: boolean;
  readOnly: boolean;
  formatCoverage: (value: number) => string;
  setWifiSource: (v: any) => void;
  setWifiBrand: (v: string) => void;
  setWifiModel: (v: string) => void;
  setWifiModelCode: (v: string) => void;
  setWifiStandard: (v: string) => void;
  setWifiBand24: (v: boolean) => void;
  setWifiBand5: (v: boolean) => void;
  setWifiBand6: (v: boolean) => void;
  setWifiCoverageSqm: (v: string) => void;
  setWifiShowRange: (v: boolean) => void;
  setWifiRangeScale: (v: number) => void;
  setWifiCatalogId: (v: string) => void;
  setWifiCatalogQuery: (v: string) => void;
  setWifiCatalogSearchOpen: (v: boolean) => void;
  t: Translate;
};

/**
 * Wi-Fi antenna configuration section of the object modal (source toggle,
 * manual fields, catalog picker, coverage + range controls). Extracted from
 * ObjectModal.tsx.
 */
export const ObjectWifiSection = ({
  wifiSource,
  wifiBrand,
  wifiModel,
  wifiModelCode,
  wifiStandard,
  wifiBand24,
  wifiBand5,
  wifiBand6,
  wifiCoverageSqm,
  wifiShowRange,
  wifiRangeScale,
  wifiCatalogId,
  wifiCoverageAreaSqm,
  wifiCoverageDiameter,
  wifiCoverageRadius,
  wifiEffectiveAreaSqm,
  wifiEffectiveDiameter,
  wifiEffectiveRadius,
  wifiFormValid,
  hasWifiCatalog,
  readOnly,
  formatCoverage,
  setWifiSource,
  setWifiBrand,
  setWifiModel,
  setWifiModelCode,
  setWifiStandard,
  setWifiBand24,
  setWifiBand5,
  setWifiBand6,
  setWifiCoverageSqm,
  setWifiShowRange,
  setWifiRangeScale,
  setWifiCatalogId,
  setWifiCatalogQuery,
  setWifiCatalogSearchOpen,
  t
}: ObjectWifiSectionProps) => (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-ink">{t({ it: 'WiFi Antenna', en: 'WiFi Antenna' })}</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={readOnly || !hasWifiCatalog}
                            onClick={() => {
                              if (!hasWifiCatalog) return;
                              setWifiSource('catalog');
                              if (!wifiCatalogId) {
                                setWifiBrand('');
                                setWifiModel('');
                                setWifiModelCode('');
                                setWifiCoverageSqm('');
                                setWifiStandard('');
                                setWifiBand24(false);
                                setWifiBand5(false);
                                setWifiBand6(false);
                                setWifiCatalogSearchOpen(true);
                              }
                            }}
                            className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                              wifiSource === 'catalog'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            } ${readOnly || !hasWifiCatalog ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            {t({ it: 'Catalogo', en: 'Catalog' })}
                          </button>
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => {
                              setWifiSource('custom');
                              setWifiCatalogId('');
                              setWifiCatalogQuery('');
                              setWifiCatalogSearchOpen(false);
                              setWifiBrand('');
                              setWifiModel('');
                              setWifiModelCode('');
                              setWifiCoverageSqm('');
                              setWifiStandard('');
                              setWifiBand24(false);
                              setWifiBand5(false);
                              setWifiBand6(false);
                            }}
                            className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                              wifiSource === 'custom'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            {t({ it: 'Custom', en: 'Custom' })}
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="space-y-3">
                          {wifiSource === 'catalog' ? (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium text-slate-700">
                                  {t({ it: 'Catalogo antenna', en: 'Antenna catalog' })}
                                </div>
                                <button
                                  type="button"
                                  disabled={readOnly || !hasWifiCatalog}
                                  onClick={() => setWifiCatalogSearchOpen(true)}
                                  className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                                    wifiCatalogId ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                  } ${readOnly || !hasWifiCatalog ? 'cursor-not-allowed opacity-60' : ''}`}
                                >
                                  {t({ it: 'Search from catalog', en: 'Search from catalog' })}
                                </button>
                              </div>
                              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                                {wifiCatalogId
                                  ? t({
                                      it: `Selezionato: ${wifiBrand} ${wifiModel} (${wifiModelCode})`,
                                      en: `Selected: ${wifiBrand} ${wifiModel} (${wifiModelCode})`
                                    })
                                  : t({ it: 'Nessun modello selezionato.', en: 'No model selected.' })}
                              </div>
                            </>
                          ) : null}
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={wifiBrand}
                                disabled={readOnly || wifiSource === 'catalog'}
                                onChange={(e) => setWifiBrand(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                placeholder={t({ it: 'Es. Ubiquiti', en: 'e.g. Ubiquiti' })}
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={wifiModel}
                                disabled={readOnly || wifiSource === 'catalog'}
                                onChange={(e) => setWifiModel(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                placeholder={t({ it: 'Es. U7 Pro', en: 'e.g. U7 Pro' })}
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Codice modello', en: 'Model code' })}
                              <input
                                value={wifiModelCode}
                                disabled={readOnly || wifiSource === 'catalog'}
                                onChange={(e) => setWifiModelCode(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                placeholder={t({ it: 'Es. U7-Pro', en: 'e.g. U7-Pro' })}
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Standard', en: 'Standard' })}
                              <select
                                value={wifiStandard}
                                disabled={readOnly || wifiSource === 'catalog'}
                                onChange={(e) => setWifiStandard(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              >
                                <option value="">{t({ it: 'Seleziona...', en: 'Select...' })}</option>
                                {WIFI_STANDARD_OPTIONS.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {t({ it: opt.it, en: opt.en })}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <div className="text-sm font-medium text-slate-700">{t({ it: 'Bande', en: 'Bands' })}</div>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={wifiBand24}
                                  disabled={readOnly || wifiSource === 'catalog'}
                                  onChange={(e) => setWifiBand24(e.target.checked)}
                                />
                                2.4 GHz
                              </label>
                              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={wifiBand5}
                                  disabled={readOnly || wifiSource === 'catalog'}
                                  onChange={(e) => setWifiBand5(e.target.checked)}
                                />
                                5 GHz
                              </label>
                              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={wifiBand6}
                                  disabled={readOnly || wifiSource === 'catalog'}
                                  onChange={(e) => setWifiBand6(e.target.checked)}
                                />
                                6 GHz
                              </label>
                            </div>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            <span className="flex items-center justify-between gap-2">
                              <span>{t({ it: 'Copertura (m2)', en: 'Coverage (m2)' })}</span>
                              {wifiCoverageRadius && wifiCoverageDiameter ? (
                                <span className="text-xs text-slate-500">
                                  {t({
                                    it: `Raggio ${formatCoverage(wifiCoverageRadius)} m · Diametro ${formatCoverage(wifiCoverageDiameter)} m`,
                                    en: `Radius ${formatCoverage(wifiCoverageRadius)} m · Diameter ${formatCoverage(wifiCoverageDiameter)} m`
                                  })}
                                </span>
                              ) : null}
                            </span>
                            <input
                              value={wifiCoverageSqm}
                              disabled={readOnly || wifiSource === 'catalog'}
                              onChange={(e) => setWifiCoverageSqm(e.target.value)}
                              inputMode="decimal"
                              type="number"
                              min={1}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              placeholder={t({ it: 'Es. 185', en: 'e.g. 185' })}
                            />
                          </label>
                          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={wifiShowRange}
                              disabled={readOnly}
                              onChange={(e) => setWifiShowRange(e.target.checked)}
                            />
                            {t({ it: 'Mostra range access point', en: 'Show access point range' })}
                          </label>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                              <span>{t({ it: 'Range (moltiplicatore)', en: 'Range (multiplier)' })}</span>
                              <span className="tabular-nums text-slate-700">x{(Number(wifiRangeScale) || 0).toFixed(2)}</span>
                            </div>
	                            <input
	                              type="range"
	                              min={0}
	                              max={WIFI_RANGE_SCALE_MAX}
	                              step={0.05}
	                              value={wifiRangeScale}
	                              disabled={readOnly}
	                              onChange={(e) => setWifiRangeScale(Number(e.target.value))}
	                              className="mt-1 w-full"
	                            />
	                            {wifiCoverageRadius &&
	                            wifiCoverageDiameter &&
	                            wifiCoverageAreaSqm &&
	                            wifiEffectiveRadius &&
	                            wifiEffectiveDiameter &&
	                            wifiEffectiveAreaSqm ? (
	                              <div className="mt-1 text-xs text-slate-500">
	                                <div>
	                                  {t({
	                                    it: `Base: r ${formatCoverage(wifiCoverageRadius)} m · d ${formatCoverage(
	                                      wifiCoverageDiameter
	                                    )} m · area ${formatCoverage(wifiCoverageAreaSqm)} m2`,
	                                    en: `Base: r ${formatCoverage(wifiCoverageRadius)} m · d ${formatCoverage(
	                                      wifiCoverageDiameter
	                                    )} m · area ${formatCoverage(wifiCoverageAreaSqm)} m2`
	                                  })}
	                                </div>
	                                <div>
	                                  {t({
	                                    it: `Esteso: r ${formatCoverage(wifiEffectiveRadius)} m · d ${formatCoverage(
	                                      wifiEffectiveDiameter
	                                    )} m · area ${formatCoverage(wifiEffectiveAreaSqm)} m2 (max r ${formatCoverage(
	                                      wifiCoverageRadius * WIFI_RANGE_SCALE_MAX
	                                    )} m)`,
	                                    en: `Extended: r ${formatCoverage(wifiEffectiveRadius)} m · d ${formatCoverage(
	                                      wifiEffectiveDiameter
	                                    )} m · area ${formatCoverage(wifiEffectiveAreaSqm)} m2 (max r ${formatCoverage(
	                                      wifiCoverageRadius * WIFI_RANGE_SCALE_MAX
	                                    )} m)`
	                                  })}
	                                </div>
	                              </div>
	                            ) : (
	                              <div className="mt-1 text-xs text-slate-500">
	                                {t({ it: 'Imposta la copertura per calcolare il raggio.', en: 'Set coverage to compute radius.' })}
	                              </div>
	                            )}
                          </div>
                          {!wifiFormValid ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                              {t({
                                it: 'Completa i campi obbligatori dell’antenna.',
                                en: 'Complete the required antenna fields.'
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
);
