import { describe, expect, it } from 'vitest';

import { formatDistance, roundCoordinate, roundCoordinates } from './geo';

describe('roundCoordinate', () => {
  it('keeps 3 decimals (about 100 m)', () => {
    expect(roundCoordinate(41.0479769)).toBe(41.048);
    expect(roundCoordinate(-0.3037891)).toBe(-0.304);
    expect(roundCoordinates({ lat: 51.4613456, lng: -0.3037891 })).toEqual({ lat: 51.461, lng: -0.304 });
  });
});

describe('formatDistance', () => {
  it('shows metres rounded to 50 below 1 km', () => {
    expect(formatDistance(337, 'en')).toBe('350 m');
    expect(formatDistance(337, 'tr')).toBe('350 m');
    expect(formatDistance(4, 'en')).toBe('50 m');
  });

  it('shows kilometres with one decimal, in the interface language', () => {
    expect(formatDistance(1234, 'en')).toBe('1.2 km');
    expect(formatDistance(1234, 'tr')).toBe('1,2 km');
    expect(formatDistance(990, 'en')).toBe('1.0 km');
  });
});
