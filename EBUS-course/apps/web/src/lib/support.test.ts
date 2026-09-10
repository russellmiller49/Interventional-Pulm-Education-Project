import { describe, expect, it } from 'vitest';

import { buildSupportMailto, SUPPORT_EMAILS } from '@/lib/support';

describe('support mail helpers', () => {
  it('builds a mailto link addressed to both course contacts', () => {
    const href = buildSupportMailto({
      contactInfo: 'learner@example.edu',
      message: 'I cannot sign in.',
      topic: 'login help',
    });

    expect(href.startsWith(`mailto:${SUPPORT_EMAILS.join(',')}?`)).toBe(true);
    expect(decodeURIComponent(href)).toContain('subject=SoCal EBUS Prep login help');
    expect(decodeURIComponent(href)).toContain('Contact info: learner@example.edu');
    expect(decodeURIComponent(href)).toContain('I cannot sign in.');
  });
});
