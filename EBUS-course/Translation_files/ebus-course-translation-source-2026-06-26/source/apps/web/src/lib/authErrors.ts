const NETWORK_ERROR_PATTERN = /failed to fetch|fetch failed|load failed|networkerror|network error/i;
const EXISTING_ACCOUNT_PATTERN = /already registered|already exists|user already/i;

function getRawErrorMessage(caught: unknown) {
  if (caught instanceof Error) {
    return caught.message;
  }

  if (typeof caught === 'string') {
    return caught;
  }

  return '';
}

function getRawErrorName(caught: unknown) {
  return caught instanceof Error ? caught.name : '';
}

export function getLearnerAuthErrorMessage(caught: unknown, fallback: string) {
  const rawMessage = getRawErrorMessage(caught);
  const searchable = `${getRawErrorName(caught)} ${rawMessage}`;

  if (NETWORK_ERROR_PATTERN.test(searchable)) {
    return [
      'We could not reach the account service, so your account was not created yet.',
      'Please check your internet connection, VPN/firewall, or browser privacy extensions, then try again.',
      'If it keeps happening, use Login help / feedback so the course team can help create or approve your account.',
    ].join(' ');
  }

  if (EXISTING_ACCOUNT_PATTERN.test(searchable)) {
    return 'An account may already exist for this email. Try signing in, or use Forgot password if you need a reset link.';
  }

  return rawMessage || fallback;
}
