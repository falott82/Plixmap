'use strict';

// Server-side, dependency-free HTML sanitizer used as a defense-in-depth layer
// before persisting user-authored rich text (e.g. meeting notes).
//
// Node has no DOMParser, so this is a conservative regex-based pass that mirrors
// the intent of the client-side `sanitizeHtmlBasic` (src/utils/sanitizeHtml.ts):
//   - strip dangerous elements (script/style/iframe/object/embed/link/meta + content)
//   - strip inline event handlers (on* attributes)
//   - neutralize `javascript:` URLs in href/src
//   - strip `srcdoc` and `data:text/html` payloads
// The client still sanitizes again on render; this prevents stored XSS at the source.
const FORBIDDEN_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form'];

const sanitizeHtmlBasic = (html) => {
  if (!html || typeof html !== 'string') return '';
  let out = html;

  // Remove forbidden elements together with their content (script/style/...),
  // and any self-closing/void variants.
  for (const tag of FORBIDDEN_TAGS) {
    const paired = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
    const lone = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    out = out.replace(paired, '').replace(lone, '');
  }

  // Strip inline event-handler attributes: on*="..." / on*='...' / on*=value
  out = out.replace(/\son[a-z0-9_-]+\s*=\s*"(?:[^"]*)"/gi, '');
  out = out.replace(/\son[a-z0-9_-]+\s*=\s*'(?:[^']*)'/gi, '');
  out = out.replace(/\son[a-z0-9_-]+\s*=\s*[^\s>]+/gi, '');

  // Neutralize javascript:/vbscript:/data:text/html URLs in href/src/srcdoc/xlink:href.
  out = out.replace(
    /\s(href|src|xlink:href)\s*=\s*"(?:\s*(?:javascript|vbscript):[^"]*|\s*data:text\/html[^"]*)"/gi,
    ' $1="#"'
  );
  out = out.replace(
    /\s(href|src|xlink:href)\s*=\s*'(?:\s*(?:javascript|vbscript):[^']*|\s*data:text\/html[^']*)'/gi,
    " $1='#'"
  );
  // Drop srcdoc entirely (can carry full HTML documents).
  out = out.replace(/\ssrcdoc\s*=\s*"(?:[^"]*)"/gi, '');
  out = out.replace(/\ssrcdoc\s*=\s*'(?:[^']*)'/gi, '');

  return out;
};

module.exports = { sanitizeHtmlBasic };
