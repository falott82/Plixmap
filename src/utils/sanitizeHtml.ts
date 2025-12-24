export const sanitizeHtmlBasic = (html: string): string => {
  if (!html || typeof html !== 'string') return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const forbidden = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'];
    forbidden.forEach((tag) => doc.querySelectorAll(tag).forEach((n) => n.remove()));

    const walk = (el: Element) => {
      // Remove inline event handlers and javascript: URLs
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || '').trim();
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
          continue;
        }
        if ((name === 'href' || name === 'src') && /^javascript:/i.test(value)) {
          el.removeAttribute(attr.name);
          continue;
        }
      }
      for (const child of Array.from(el.children)) walk(child);
    };
    for (const child of Array.from(doc.body.children)) walk(child);

    return doc.body.innerHTML || '';
  } catch {
    // If parsing fails, fall back to a very conservative output.
    return String(html).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').trim();
  }
};

