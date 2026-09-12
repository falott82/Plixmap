'use strict';

// Server-side allowlist HTML sanitizer (defense-in-depth before persisting user-authored
// rich text, e.g. meeting/client notes). Uses sanitize-html (pure Node) with an allowlist
// mirroring the client-side DOMPurify config (src/utils/sanitizeHtml.ts) — same set of tags
// the Lexical editor emits. The client also re-sanitizes on render.
const sanitizeHtml = require('sanitize-html');

const ALLOWED_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'mark',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'a', 'span', 'div', 'hr', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'
];

const OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['style', 'class', 'dir', 'colspan', 'rowspan', 'align', 'valign']
  },
  // href/src only via safe schemes; data: allowed on <img> only (embedded images).
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  // Drop these tags AND their text content (executable / non-rendered).
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
  // Disallowed attributes (on*, srcdoc, etc.) are dropped by the allowlist above.
  transformTags: {
    a: (tagName, attribs) => {
      if (attribs.target) attribs.rel = 'noopener noreferrer';
      return { tagName, attribs };
    }
  }
};

const sanitizeHtmlBasic = (html) => {
  if (!html || typeof html !== 'string') return '';
  try {
    return sanitizeHtml(html, OPTIONS);
  } catch {
    // Fail closed.
    return '';
  }
};

module.exports = { sanitizeHtmlBasic };
