import { beforeEach, describe, expect, it } from 'vitest';

import { rememberReturnPath, takeReturnPath } from './return-path';

describe('return path after sign-in', () => {
  beforeEach(() => sessionStorage.clear());

  it('brings the visitor back to the page they left, once', () => {
    window.history.replaceState(null, '', '/brand/branch?q=pizza');
    rememberReturnPath();

    expect(takeReturnPath()).toBe('/brand/branch?q=pizza');
    expect(takeReturnPath()).toBe('/');
  });

  it('never leaves the site', () => {
    rememberReturnPath('//evil.example');
    expect(takeReturnPath()).toBe('/');
    sessionStorage.setItem('runmeal_return_path', 'https://evil.example');
    expect(takeReturnPath()).toBe('/');
  });
});
