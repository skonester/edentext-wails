// The size box's Chinese named sizes (字号) and typed-size parsing.
import { describe, it, expect } from 'vitest';
import { parseSize, sizeLabel, sizeMenu } from '../src/lib/utils/fontSize';

describe('font size names', () => {
  it('parses names and numbers', () => {
    expect(parseSize('小四')).toBe(12);
    expect(parseSize('10,5')).toBe(10.5);
    expect(parseSize('xx')).toBeNull();
    expect(parseSize('500')).toBeNull();
  });
  it('labels a size by name only when asked', () => {
    expect(sizeLabel('10.5pt', true)).toBe('五号');
    expect(sizeLabel('13pt', true)).toBe('13');
    expect(sizeLabel('12pt', false)).toBe('12');
    expect(sizeMenu(false)[0]).toEqual(['8', 8]);
    expect(sizeMenu(true)[0]).toEqual(['初号', 42]);
  });
});
