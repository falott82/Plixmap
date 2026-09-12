import type { ReactNode } from 'react';

type Localized = { it: string; en: string };

// Keybinding toast content (a titled list of shortcut hints) extracted from usePlanView.
// `t` is the localiser; returns the toast body node.
export const renderKeybindToastContent = (
  title: Localized,
  items: Array<{ cmd: string; it: string; en: string }>,
  t: (v: Localized) => string
): ReactNode => (
  <div className="text-left text-slate-900">
    <div className="text-sm font-semibold text-slate-900">{t(title)}</div>
    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-900">
      {items.map((item, index) => (
        <li key={`${item.cmd}-${index}`}>
          <strong className="font-semibold">{item.cmd}</strong> {t({ it: item.it, en: item.en })}
        </li>
      ))}
    </ul>
  </div>
);
