import { expect, it } from 'vitest';

import { renderMarkdown } from './markdown';

it('renders markdown', () => {
  expect(renderMarkdown('- **eins**')).toContain('<li><strong>eins</strong></li>');
});

it('shows raw html as text, never as elements', () => {
  const dom = document.createElement('div');
  dom.innerHTML = renderMarkdown('Hallo <script>alert(1)</script> <b onclick="x()">fett</b>');

  expect(dom.querySelector('script, b, [onclick]')).toBeNull();
  expect(dom.textContent).toContain('<script>');
});

it('loads no images and makes no dangerous links', () => {
  expect(renderMarkdown('![Pixel](https://tracker.example/p.png)')).not.toContain('<img');
  for (const url of ['javascript:alert(1)', 'data:text/html,<b>x</b>']) {
    expect(renderMarkdown(`[Klick](${url})`)).not.toContain('href');
  }
});

it('opens safe links in a new tab without referrer', () => {
  const html = renderMarkdown('[Doku](https://example.com)');

  expect(html).toContain('href="https://example.com"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="noopener noreferrer"');
});
