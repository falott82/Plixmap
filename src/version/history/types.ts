export interface ReleaseNote {
  version: string;
  date: string;
  type: 'fix' | 'minor' | 'major';
  notes: { it: string; en: string }[];
}

export const n = (it: string, en: string): { it: string; en: string } => ({ it, en });
