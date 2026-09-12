/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { isSecurityTypeId } from '../../store/security';
import { DESK_TYPE_IDS, isDeskType } from './deskTypes';

// Palette definition derivations (favorite order, has-custom/empty/more flags, desk/security/other
// palette def lists + desk order) extracted from usePlanView. Pure derivations of the favorites
// list + object type defs; bodies moved verbatim (dep arrays preserved exactly).
export const usePlanPaletteDefs = (deps: any) => {
  const { paletteFavorites, objectTypeDefs, isWallType, isDoorType } = deps;

  const paletteOrder = useMemo(() => {
    const fav = Array.isArray(paletteFavorites) ? paletteFavorites : [];
    return fav.filter((id: string) => !isWallType(id) && !isDoorType(id) && !isSecurityTypeId(id));
  }, [isDoorType, isWallType, paletteFavorites]);
  // User-configured palette: list can be empty (meaning no objects enabled).
  const paletteHasCustom = paletteOrder.length > 0;
  const paletteIsEmpty = Array.isArray(paletteFavorites) && paletteOrder.length === 0;
  const paletteHasMore = useMemo(() => {
    const all = (objectTypeDefs || [])
      .map((d: any) => d.id)
      .filter((id: string) => !isDeskType(id) && !isWallType(id) && !isDoorType(id) && !isSecurityTypeId(id));
    const fav = new Set(paletteOrder);
    return all.some((id: string) => !fav.has(id));
  }, [isDoorType, isWallType, objectTypeDefs, paletteOrder]);
  const deskTypeSet = useMemo(() => new Set(DESK_TYPE_IDS as readonly string[]), []);
  const deskPaletteDefs = useMemo(() => {
    const defs = objectTypeDefs || [];
    return defs.filter((d: any) => deskTypeSet.has(d.id));
  }, [deskTypeSet, objectTypeDefs]);
  const deskPaletteOrder = useMemo(() => {
    const filtered = paletteOrder.filter((id: string) => deskTypeSet.has(id));
    return filtered.length ? filtered : undefined;
  }, [deskTypeSet, paletteOrder]);
  const securityPaletteDefs = useMemo(() => {
    const defs = objectTypeDefs || [];
    return defs.filter((d: any) => isSecurityTypeId(d.id));
  }, [objectTypeDefs]);
  const otherPaletteDefs = useMemo(() => {
    const defs = objectTypeDefs || [];
    return defs.filter((d: any) => !deskTypeSet.has(d.id) && !isWallType(d.id) && !isDoorType(d.id) && !isSecurityTypeId(d.id));
  }, [deskTypeSet, isDoorType, isWallType, objectTypeDefs]);

  return {
    paletteOrder,
    paletteHasCustom,
    paletteIsEmpty,
    paletteHasMore,
    deskTypeSet,
    deskPaletteDefs,
    deskPaletteOrder,
    securityPaletteDefs,
    otherPaletteDefs,
  };
};
