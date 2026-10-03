import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: false });
markdown.disable('image');

const ALLOWED_LINK = /^(https?:|mailto:)/i;
markdown.validateLink = (url) => ALLOWED_LINK.test(url.trim());

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(markdown.render(source), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['img', 'style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
    ADD_ATTR: ['target'],
  });
}
