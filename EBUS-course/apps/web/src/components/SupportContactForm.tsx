import { useMemo, useState } from 'react';

import { buildSupportMailto, SUPPORT_EMAILS } from '@/lib/support';

const SUPPORT_TOPICS = [
  { id: 'login help', label: 'Login help' },
  { id: 'technical problem', label: 'Technical problem' },
  { id: 'course feedback', label: 'Course feedback' },
] as const;

export function SupportContactForm({
  defaultContactInfo = '',
  onCancel,
}: {
  defaultContactInfo?: string;
  onCancel?: () => void;
}) {
  const [topic, setTopic] = useState<string>(SUPPORT_TOPICS[0].id);
  const [contactInfo, setContactInfo] = useState(defaultContactInfo);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const canSend = contactInfo.trim().length > 0 && message.trim().length > 0;
  const mailtoHref = useMemo(
    () => buildSupportMailto({ contactInfo, message, topic }),
    [contactInfo, message, topic],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    setSubmitted(true);
    window.location.href = mailtoHref;
  }

  return (
    <form className="auth-form support-form" onSubmit={handleSubmit}>
      <div className="support-contact-list" aria-label="Support recipients">
        {SUPPORT_EMAILS.map((email) => (
          <span key={email}>{email}</span>
        ))}
      </div>
      <label className="field">
        <span>Reason</span>
        <select onChange={(event) => setTopic(event.target.value)} value={topic}>
          {SUPPORT_TOPICS.map((nextTopic) => (
            <option key={nextTopic.id} value={nextTopic.id}>
              {nextTopic.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Your contact info</span>
        <input
          autoComplete="email"
          onChange={(event) => setContactInfo(event.target.value)}
          placeholder="Email or phone"
          required
          type="text"
          value={contactInfo}
        />
      </label>
      <label className="field">
        <span>Message</span>
        <textarea
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Tell us what happened or what feedback you want to share."
          required
          rows={6}
          value={message}
        />
      </label>
      {submitted ? (
        <p className="auth-card__message">
          Your email app should open with the message. If it does not, use the draft link below.
        </p>
      ) : null}
      <div className="button-row button-row--wrap">
        <button className="button" disabled={!canSend} type="submit">
          Open email draft
        </button>
        <a className="button button--ghost" href={canSend ? mailtoHref : `mailto:${SUPPORT_EMAILS.join(',')}`}>
          Email directly
        </a>
        {onCancel ? (
          <button className="button button--ghost" onClick={onCancel} type="button">
            Back to sign in
          </button>
        ) : null}
      </div>
    </form>
  );
}
