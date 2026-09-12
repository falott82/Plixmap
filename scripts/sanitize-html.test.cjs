'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sanitizeHtmlBasic } = require('../server/utils/sanitizeHtml.cjs');

test('returns empty string for non-string / empty input', () => {
  assert.strictEqual(sanitizeHtmlBasic(''), '');
  assert.strictEqual(sanitizeHtmlBasic(null), '');
  assert.strictEqual(sanitizeHtmlBasic(undefined), '');
  assert.strictEqual(sanitizeHtmlBasic(42), '');
});

test('preserves safe formatting markup', () => {
  const html = '<p>Hello <strong>world</strong> <a href="https://example.com">link</a></p>';
  assert.strictEqual(sanitizeHtmlBasic(html), html);
});

test('removes <script> elements and their content', () => {
  const out = sanitizeHtmlBasic('<p>ok</p><script>alert(1)</script>');
  assert.strictEqual(out, '<p>ok</p>');
  assert.ok(!/alert/.test(out));
});

test('removes style/iframe/object/embed/link/meta/base/form elements', () => {
  for (const tag of ['style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form']) {
    const out = sanitizeHtmlBasic(`<p>ok</p><${tag}>x</${tag}>`);
    assert.ok(!new RegExp(`<${tag}`, 'i').test(out), `expected <${tag}> removed, got: ${out}`);
  }
});

test('strips inline event-handler attributes', () => {
  const out = sanitizeHtmlBasic('<img src="x" onerror="alert(1)">');
  assert.ok(!/onerror/i.test(out), out);
});

test('strips event handlers regardless of quoting', () => {
  assert.ok(!/onclick/i.test(sanitizeHtmlBasic(`<div onclick='steal()'>x</div>`)));
  assert.ok(!/onclick/i.test(sanitizeHtmlBasic('<div onclick=steal()>x</div>')));
});

test('neutralizes javascript: and vbscript: URLs', () => {
  assert.ok(!/javascript:/i.test(sanitizeHtmlBasic('<a href="javascript:alert(1)">x</a>')));
  assert.ok(!/vbscript:/i.test(sanitizeHtmlBasic(`<a href='vbscript:msgbox(1)'>x</a>`)));
});

test('neutralizes data:text/html payloads in src', () => {
  assert.ok(!/data:text\/html/i.test(sanitizeHtmlBasic('<a href="data:text/html,<script>alert(1)</script>">x</a>')));
});

test('drops srcdoc attribute', () => {
  assert.ok(!/srcdoc/i.test(sanitizeHtmlBasic('<iframe srcdoc="<script>x</script>"></iframe>')));
});

test('allowlist drops unknown/dangerous tags the old denylist missed', () => {
  // svg + event handlers, math, etc. are not on the allowlist → removed entirely.
  assert.ok(!/<svg/i.test(sanitizeHtmlBasic('<svg onload="alert(1)"><circle /></svg>')));
  assert.ok(!/onload/i.test(sanitizeHtmlBasic('<svg onload="alert(1)"></svg>')));
});

test('strips style-based and srcset/formaction vectors', () => {
  assert.ok(!/formaction/i.test(sanitizeHtmlBasic('<button formaction="javascript:alert(1)">x</button>')));
  assert.ok(!/srcset/i.test(sanitizeHtmlBasic('<img srcset="x" src="https://e.com/i.png">')));
});

test('keeps data:image on <img> but not on <a>', () => {
  const img = sanitizeHtmlBasic('<img src="data:image/png;base64,iVBOR">');
  assert.ok(/data:image/i.test(img), img);
  const a = sanitizeHtmlBasic('<a href="data:image/png;base64,iVBOR">x</a>');
  assert.ok(!/data:image/i.test(a), a);
});

test('adds rel=noopener to target=_blank links', () => {
  const out = sanitizeHtmlBasic('<a href="https://e.com" target="_blank">x</a>');
  assert.ok(/rel="noopener noreferrer"/.test(out), out);
});
