import { useEffect, type Dispatch, type SetStateAction } from 'react';

export type UsePlanPaletteSectionEffectsDeps = {
  paletteSection: 'desks' | 'objects' | 'security';
  setPaletteSection: Dispatch<SetStateAction<'desks' | 'objects' | 'security'>>;
  deskPaletteDefs: { length: number };
  otherPaletteDefs: { length: number };
  securityPaletteDefs: { length: number };
  setDesksOpen: Dispatch<SetStateAction<boolean>>;
  setObjectsOpen: Dispatch<SetStateAction<boolean>>;
  setSecurityOpen: Dispatch<SetStateAction<boolean>>;
};

export function usePlanPaletteSectionEffects(deps: UsePlanPaletteSectionEffectsDeps) {
  const {
    paletteSection,
    setPaletteSection,
    deskPaletteDefs,
    otherPaletteDefs,
    securityPaletteDefs,
    setDesksOpen,
    setObjectsOpen,
    setSecurityOpen
  } = deps;

  useEffect(() => {
    if (paletteSection === 'desks' && !deskPaletteDefs.length) {
      setPaletteSection('objects');
    } else if (paletteSection === 'objects' && !otherPaletteDefs.length && deskPaletteDefs.length) {
      setPaletteSection('desks');
    } else if (paletteSection === 'objects' && !otherPaletteDefs.length && !deskPaletteDefs.length && securityPaletteDefs.length) {
      setPaletteSection('security');
    } else if (paletteSection === 'security' && !securityPaletteDefs.length) {
      setPaletteSection(otherPaletteDefs.length ? 'objects' : 'desks');
    }
  }, [deskPaletteDefs.length, otherPaletteDefs.length, paletteSection, securityPaletteDefs.length]);

  useEffect(() => {
    if (!deskPaletteDefs.length) setDesksOpen(false);
    if (!otherPaletteDefs.length) setObjectsOpen(false);
    if (!securityPaletteDefs.length) setSecurityOpen(false);
  }, [deskPaletteDefs.length, otherPaletteDefs.length, securityPaletteDefs.length]);
}
