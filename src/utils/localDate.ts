export const toLocalIsoDay = (value: Date | number | string = new Date()): string => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}-${String(safeDate.getDate()).padStart(2, '0')}`;
};

export const currentLocalIsoDay = (): string => toLocalIsoDay(new Date());

export const toLocalMonthAnchor = (value: Date | number | string = new Date()): string => `${toLocalIsoDay(value).slice(0, 7)}-01`;
