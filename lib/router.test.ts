import { describe, expect, it } from 'vitest';

import { idSegment, parseHash, routeName } from './router';

describe('parseHash', () => {
  it('falls back when there is no hash', () => {
    expect(parseHash('')).toMatchObject({ path: '/issues' });
    expect(parseHash('#')).toMatchObject({ path: '/issues' });
    expect(parseHash('#/')).toMatchObject({ path: '/issues' });
  });

  it('normalises leading and trailing slashes', () => {
    expect(parseHash('#/projects/').path).toBe('/projects');
    expect(parseHash('#projects').path).toBe('/projects');
    expect(parseHash('#//projects//').path).toBe('/projects');
  });

  it('splits segments', () => {
    expect(parseHash('#/issues/42').segments).toEqual(['issues', '42']);
  });

  it('keeps v1\'s deep link working', () => {
    // The context menu still navigates here.
    expect(parseHash('#/new-issue').path).toBe('/new-issue');
  });
});

describe('idSegment', () => {
  it('reads a positive integer id', () => {
    expect(idSegment(parseHash('#/issues/42'))).toBe(42);
  });

  it('returns null for anything else', () => {
    expect(idSegment(parseHash('#/issues'))).toBeNull();
    expect(idSegment(parseHash('#/issues/abc'))).toBeNull();
    expect(idSegment(parseHash('#/issues/-1'))).toBeNull();
    expect(idSegment(parseHash('#/issues/1.5'))).toBeNull();
  });
});

describe('routeName', () => {
  it('names the first segment', () => {
    expect(routeName(parseHash('#/projects/7'))).toBe('projects');
    expect(routeName(parseHash(''))).toBe('issues');
  });
});
