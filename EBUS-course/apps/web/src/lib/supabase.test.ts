import { describe, expect, it } from 'vitest';

import {
  buildAuthCallbackUrl,
  buildSharedAuthCallbackUrl,
  getBrowserAuthCallbackMode,
  readAuthParamsFromUrlParts,
} from '@/lib/supabase';

describe('Supabase auth URL helpers', () => {
  it('builds password recovery callbacks at the app base URL', () => {
    expect(buildAuthCallbackUrl('https://course.example.edu/socal-ebus-course/app', 'reset-password')).toBe(
      'https://course.example.edu/socal-ebus-course/app/?authMode=reset-password',
    );
  });

  it('builds shared website callbacks for the EBUS app', () => {
    expect(buildSharedAuthCallbackUrl('https://interventionalpulm.org/auth/callback', 'reset-password')).toBe(
      'https://interventionalpulm.org/auth/callback?app=socal-ebus-course&authMode=reset-password',
    );
  });

  it('does not report a browser callback mode in non-browser tests', () => {
    expect(getBrowserAuthCallbackMode()).toBeNull();
  });

  it('reads Supabase tokens from a hash router callback URL', () => {
    const params = readAuthParamsFromUrlParts(
      '',
      '#/auth?mode=reset-password&authMode=reset-password&access_token=access.value&refresh_token=refresh.value&expires_in=3600&token_type=bearer&type=recovery',
    );

    expect(params.get('mode')).toBe('reset-password');
    expect(params.get('authMode')).toBe('reset-password');
    expect(params.get('access_token')).toBe('access.value');
    expect(params.get('refresh_token')).toBe('refresh.value');
    expect(params.get('type')).toBe('recovery');
  });

  it('reads Supabase auth codes from a hash router callback URL', () => {
    const params = readAuthParamsFromUrlParts(
      '?authCallback=1',
      '#/auth?mode=reset-password&authMode=reset-password&code=recovery.code.value',
    );

    expect(params.get('authCallback')).toBe('1');
    expect(params.get('mode')).toBe('reset-password');
    expect(params.get('authMode')).toBe('reset-password');
    expect(params.get('code')).toBe('recovery.code.value');
  });
});
