import DOMPurify from 'dompurify';

// Allowlist of tags/attributes that the Lexical rich-text editor can emit for notes.
// Anything not on these lists is dropped by DOMPurify. This is an allowlist sanitizer
// (replacing the previous denylist), so unknown/dangerous vectors fail closed.
const ALLOWED_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'mark',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'a', 'span', 'div', 'hr', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'src', 'alt', 'title', 'style', 'class', 'dir',
  'colspan', 'rowspan', 'width', 'height', 'align', 'valign'
];

let hookInstalled = false;
const ensureHooks = () => {
  if (hookInstalled || typeof (DOMPurify as { addHook?: unknown }).addHook !== 'function') return;
  hookInstalled = true;
  // Harden links that open in a new tab against reverse-tabnabbing.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target')) {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
};

export const sanitizeHtmlBasic = (html: string): string => {
  if (!html || typeof html !== 'string') return '';
  try {
    ensureHooks();
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      // Permit data:image/* on <img> for embedded/pasted images (DOMPurify still blocks
      // javascript:, vbscript:, and data: SVG/HTML payloads).
      ADD_DATA_URI_TAGS: ['img'],
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form'],
      FORBID_ATTR: ['srcset', 'formaction', 'xlink:href', 'ping']
    });
  } catch {
    // Fail closed: if sanitization throws, return nothing rather than unsafe markup.
    return '';
  }
};
