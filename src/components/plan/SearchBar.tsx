import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useT } from '../../i18n/useT';

interface Props {
  onSearch: (term: string) => void;
  onEnter?: (term: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  className?: string;
}

const SearchBar = ({ onSearch, onEnter, inputRef, className }: Props) => {
  const t = useT();
  const [term, setTerm] = useState('');

  const handleChange = (value: string) => {
    setTerm(value);
    onSearch(value);
  };

  return (
    <div className={`relative ${className || 'w-full max-w-md'}`}>
      <Search size={16} className="absolute left-3 top-3 text-slate-400" />
      <input
        ref={inputRef}
        value={term}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter?.(e.currentTarget.value);
          }
        }}
        placeholder={t({ it: 'Cerca per nome o descrizione', en: 'Search by name or description' })}
        className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2 text-sm shadow-inner outline-none ring-primary/30 focus:ring-2"
      />
      {term ? (
        <button
          onClick={() => handleChange('')}
          className="absolute right-3 top-2 rounded-full p-1 text-slate-400 hover:text-ink"
          title={t({ it: 'Pulisci', en: 'Clear' })}
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
};

export default SearchBar;
