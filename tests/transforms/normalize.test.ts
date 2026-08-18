import {describe, expect, it} from 'vitest';
import {normalizeDomain, normalizeUrl} from '@/lib/transforms/normalize';

describe('normalization', () => {
  it.each([
    ['HTTPS://WWW.Example.COM:443/path?q=1#x', 'example.com'],
    ['example.com.', 'example.com'],
    ['http://sub.example.com/a', 'sub.example.com'],
    ['example.com:8443/path', 'example.com'],
  ])('normalizes %s as a domain', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each([
    ['', null],
    ['https://user:pass@example.com', null],
    ['http://127.0.0.1/path', null],
    ['http://[::1]/path', null],
    ['http://localhost/path', null],
    ['http://not-a-public-host/path', null],
  ])('rejects invalid domain input %s', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it('preserves a landing page path and query while removing fragment and default port', () => {
    expect(normalizeUrl('HTTPS://WWW.Example.COM:443/Offer?utm_source=ad#details'))
      .toBe('https://www.example.com/Offer?utm_source=ad');
  });

  it('preserves a non-default port in a normalized landing URL', () => {
    expect(normalizeUrl('http://Example.COM:8080/path?q=1#fragment'))
      .toBe('http://example.com:8080/path?q=1');
  });
});
