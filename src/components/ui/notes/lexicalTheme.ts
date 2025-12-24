export const lexicalTheme = {
  paragraph: 'my-2 leading-[1.45] text-slate-800',
  quote: 'border-l-4 border-slate-200 pl-4 italic text-slate-700',
  heading: {
    h1: 'my-3 text-2xl font-extrabold text-slate-900',
    h2: 'my-3 text-xl font-bold text-slate-900',
    h3: 'my-3 text-lg font-bold text-slate-900'
  },
  list: {
    nested: {
      listitem: 'my-1'
    },
    ol: 'my-2 ml-6 list-decimal',
    ul: 'my-2 ml-6 list-disc',
    listitem: 'my-1'
  },
  link: 'text-primary underline',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: 'underline line-through'
  },
  table: 'my-2 w-full border-collapse',
  tableCell: 'border border-slate-300 px-2 py-1 align-top',
  tableCellHeader: 'border border-slate-300 bg-slate-50 px-2 py-1 align-top font-semibold'
};

