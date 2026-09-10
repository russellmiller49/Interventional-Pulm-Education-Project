export const SUPPORT_EMAILS = ['russellmiller49@gmail.com', 'aachrissian@gmail.com'] as const;

export interface SupportMessageInput {
  contactInfo: string;
  message: string;
  topic: string;
}

export function buildSupportMailto({ contactInfo, message, topic }: SupportMessageInput) {
  const subject = `SoCal EBUS Prep ${topic}`;
  const body = [
    `Topic: ${topic}`,
    `Contact info: ${contactInfo.trim()}`,
    '',
    'Message:',
    message.trim(),
  ].join('\n');

  return `mailto:${SUPPORT_EMAILS.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
