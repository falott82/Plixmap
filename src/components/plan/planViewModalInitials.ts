import { WIFI_DEFAULT_STANDARD } from '../../store/data';
import { isSecurityTypeId } from '../../store/security';
import type { FloorPlan, MapObject, MapObjectType } from '../../store/types';

type Pt = { x: number; y: number };

type ModalState =
  | { mode: 'create'; type: MapObjectType; coords: Pt; textBoxWidth?: number; textBoxHeight?: number }
  | { mode: 'edit'; objectId: string }
  | { mode: 'duplicate'; objectId: string; coords: Pt }
  | null;

export type ModalInitialsDeps = {
  modalState: ModalState;
  renderPlan: FloorPlan | undefined;
  renderPlanObjectById: Map<string, MapObject>;
  layerIdSet: Set<string>;
  defaultObjectScale: number;
  getTypeLayerIds: (typeId: string) => string[] | null;
  inferDefaultLayerIds: (typeId: string, layerIdSet?: Set<string>) => string[];
  formatQuoteLabel: (points: Pt[]) => string | null;
  lastQuoteLabelScale: number;
  lastQuoteLabelBg: boolean;
  lastQuoteLabelPosH: 'center' | 'above' | 'below';
  lastQuoteDashed: boolean;
  lastQuoteEndpoint: 'arrows' | 'dots' | 'none';
  lastQuoteColor: string;
  lastQuoteLabelColor: string;
};

// Pure computation extracted from usePlanView's `modalInitials` useMemo. Behaviour is
// identical; closed-over values are passed in via `deps` (mirroring the original dependency
// array), and the useMemo wrapper + its deps stay unchanged in the hook.
export const computeModalInitials = (deps: ModalInitialsDeps) => {
  const {
    modalState,
    renderPlan,
    renderPlanObjectById,
    layerIdSet,
    defaultObjectScale,
    getTypeLayerIds,
    inferDefaultLayerIds,
    formatQuoteLabel,
    lastQuoteLabelScale,
    lastQuoteLabelBg,
    lastQuoteLabelPosH,
    lastQuoteDashed,
    lastQuoteEndpoint,
    lastQuoteColor,
    lastQuoteLabelColor
  } = deps;
  if (!modalState || !renderPlan) return null;
  if (modalState.mode === 'create') {
    const fallbackLayerIds =
      modalState.type === 'quote' ? ['quotes'] : (getTypeLayerIds(modalState.type) || inferDefaultLayerIds(modalState.type, layerIdSet));
    return {
      type: modalState.type,
      name: '',
      description: '',
      layerIds: fallbackLayerIds,
      scale: defaultObjectScale,
      ...(modalState.type === 'quote'
        ? {
            quoteLabelScale: lastQuoteLabelScale,
            quoteLabelBg: lastQuoteLabelBg,
            quoteLabelPos: lastQuoteLabelPosH,
            quoteDashed: lastQuoteDashed,
            quoteEndpoint: lastQuoteEndpoint,
            quoteColor: lastQuoteColor,
            quoteLabelColor: lastQuoteLabelColor
          }
        : {}),
      ...(modalState.type === 'text'
        ? {
            textBg: false,
            textBgColor: '#ffffff'
          }
        : {}),
      ...(modalState.type === 'wifi'
        ? {
            wifiStandard: WIFI_DEFAULT_STANDARD,
            wifiBand24: false,
            wifiBand5: false,
            wifiBand6: false,
            wifiShowRange: true,
            wifiRangeScale: 1
          }
        : {}),
      ...(isSecurityTypeId(modalState.type)
        ? {
            notes: '',
            lastVerificationAt: '',
            verifierCompany: '',
            gpsCoords: '',
            securityDocuments: [],
            securityCheckHistory: []
          }
        : {})
    };
  }
  const obj = renderPlanObjectById.get(modalState.objectId);
  if (!obj) return null;
  const quoteLabel = obj.type === 'quote' ? formatQuoteLabel(obj.points || []) : undefined;
  return {
    type: obj.type,
    name: modalState.mode === 'duplicate' ? '' : obj.name,
    description: modalState.mode === 'duplicate' ? '' : obj.description || '',
    layerIds:
      modalState.mode === 'duplicate'
        ? (obj.layerIds || getTypeLayerIds(obj.type) || inferDefaultLayerIds(obj.type, layerIdSet))
        : (obj.layerIds || getTypeLayerIds(obj.type) || inferDefaultLayerIds(obj.type, layerIdSet)),
    scale: Number.isFinite(obj.scale as number) ? Number(obj.scale) : defaultObjectScale,
    quoteLabelScale: Number.isFinite((obj as any).quoteLabelScale) ? Number((obj as any).quoteLabelScale) : lastQuoteLabelScale,
    quoteLabelBg: (obj as any).quoteLabelBg ?? lastQuoteLabelBg,
    quoteLabelColor: (obj as any).quoteLabelColor ?? lastQuoteLabelColor,
    quoteLabelOffset: (obj as any).quoteLabelOffset,
    quoteLabelPos: (obj as any).quoteLabelPos,
    quoteDashed: !!(obj as any).quoteDashed,
    quoteEndpoint: (obj as any).quoteEndpoint,
    quoteColor: obj.strokeColor,
    quoteLengthLabel: quoteLabel,
    quotePoints: obj.points,
    textFont: (obj as any).textFont,
    textSize: (obj as any).textSize,
    textColor: (obj as any).textColor,
    textBg: (obj as any).textBg,
    textBgColor: (obj as any).textBgColor,
    imageUrl: (obj as any).imageUrl,
    imageWidth: (obj as any).imageWidth,
    imageHeight: (obj as any).imageHeight,
    ip: (obj as any).ip,
    url: (obj as any).url,
    notes: (obj as any).notes,
    lastVerificationAt: (obj as any).lastVerificationAt,
    verifierCompany: (obj as any).verifierCompany,
    gpsCoords: (obj as any).gpsCoords,
    securityDocuments: (obj as any).securityDocuments,
    securityCheckHistory: (obj as any).securityCheckHistory,
      ...(obj.type === 'wifi'
        ? {
          wifiDb: (obj as any).wifiDb,
          wifiStandard: (obj as any).wifiStandard || WIFI_DEFAULT_STANDARD,
          wifiBand24: !!(obj as any).wifiBand24,
          wifiBand5: !!(obj as any).wifiBand5,
          wifiBand6: !!(obj as any).wifiBand6,
          wifiBrand: (obj as any).wifiBrand,
          wifiModel: (obj as any).wifiModel,
          wifiModelCode: (obj as any).wifiModelCode,
          wifiCoverageSqm: (obj as any).wifiCoverageSqm,
          wifiCatalogId: (obj as any).wifiCatalogId,
          wifiShowRange: (obj as any).wifiShowRange,
          wifiRangeScale: (obj as any).wifiRangeScale
        }
      : {})
  };
};
