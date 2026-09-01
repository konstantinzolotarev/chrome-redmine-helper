import { describe, expect, it } from 'vitest';

import { issueUrl, tokenize } from './markup';

describe('tokenize', () => {
  it('returns nothing for empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize(null)).toEqual([]);
    expect(tokenize(undefined)).toEqual([]);
  });

  it('passes plain text through as a single segment', () => {
    expect(tokenize('just words')).toEqual([{ type: 'text', value: 'just words' }]);
  });

  it('extracts links', () => {
    expect(tokenize('see https://example.com/x for more')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'url', value: 'https://example.com/x' },
      { type: 'text', value: ' for more' },
    ]);
  });

  it('leaves trailing punctuation out of the link', () => {
    expect(tokenize('read https://example.com/page.')).toEqual([
      { type: 'text', value: 'read ' },
      { type: 'url', value: 'https://example.com/page' },
      { type: 'text', value: '.' },
    ]);
  });

  it('extracts issue references', () => {
    expect(tokenize('duplicate of #1234')).toEqual([
      { type: 'text', value: 'duplicate of ' },
      { type: 'issue', value: '#1234', id: 1234 },
    ]);
  });

  it('ignores things that only look like references', () => {
    expect(tokenize('colour #ff0000')).toEqual([{ type: 'text', value: 'colour #ff0000' }]);
    expect(tokenize('a##5')).toEqual([{ type: 'text', value: 'a##5' }]);
  });

  it('never emits HTML, whatever the input contains', () => {
    // The D1 regression: v1 injected values like this via element.html().
    const hostile = '<img src=x onerror="alert(1)"> and <script>bad()</script>';
    const segments = tokenize(hostile);

    expect(segments).toEqual([{ type: 'text', value: hostile }]);
    // The value is carried as data; the component escapes it on render.
    expect(segments.every((segment) => segment.type === 'text')).toBe(true);
  });

  it('preserves newlines for the renderer to handle', () => {
    expect(tokenize('one\ntwo')).toEqual([{ type: 'text', value: 'one\ntwo' }]);
  });

  it('handles several matches in one string', () => {
    const segments = tokenize('#1 then https://a.test then #22');
    expect(segments.filter((s) => s.type === 'issue')).toHaveLength(2);
    expect(segments.filter((s) => s.type === 'url')).toHaveLength(1);
  });
});

describe('issueUrl', () => {
  it('builds an absolute issue URL', () => {
    expect(issueUrl('https://redmine.test', 42)).toBe('https://redmine.test/issues/42');
    expect(issueUrl('https://redmine.test/', 42)).toBe('https://redmine.test/issues/42');
  });
});
