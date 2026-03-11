type Translator = (msg: { it: string; en: string }) => string;

type ConfirmDeleteStaticDeps = {
  deleteObject: (id: string) => void,
  push: (message: string, kind: 'info' | 'success' | 'danger') => void,
  setConfirmDelete: (value: string[] | null) => void,
  setContextMenu: (value: any) => void,
  clearSelection: () => void,
  t: Translator
};

export const createPlanConfirmDeleteShortcutHandler = ({
  deleteObject,
  push,
  setConfirmDelete,
  setContextMenu,
  clearSelection,
  t
}: ConfirmDeleteStaticDeps) =>
  (
    e: KeyboardEvent,
    currentConfirm: string[] | null
  ): boolean => {
    if (!currentConfirm || !currentConfirm.length) return false;
    if (e.key === 'Escape') {
      e.preventDefault();
      setConfirmDelete(null);
      return true;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      currentConfirm.forEach((id) => deleteObject(id));
      push(
        currentConfirm.length === 1
          ? t({ it: 'Oggetto eliminato', en: 'Object deleted' })
          : t({ it: 'Oggetti eliminati', en: 'Objects deleted' }),
        'info'
      );
      setConfirmDelete(null);
      setContextMenu(null);
      clearSelection();
      return true;
    }
    return false;
  };
