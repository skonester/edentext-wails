// The desktop shell's bridge: bytes cross it as Go's []byte JSON form (standard,
// padded base64), and in a browser every entry point is inert.
import { describe, it, expect } from 'vitest';
import { isDesktop, toBase64, fromBase64, onDesktopFile, setCloseWarning } from '../../src/lib/utils/desktop';

describe('desktop bridge', () => {
  it('encodes as Go does, across the chunk boundary', () => {
    const bytes = new Uint8Array(0x8000 * 2 + 3).map((_, i) => (i * 31) & 0xff);
    const b64 = toBase64(bytes);
    expect(b64).toBe(Buffer.from(bytes).toString('base64'));
    expect(fromBase64(b64)).toEqual(bytes);
    expect(toBase64(new Uint8Array())).toBe('');
  });

  it('does nothing outside the shell', () => {
    expect(isDesktop).toBe(false);
    let opened = false;
    const off = onDesktopFile(() => (opened = true));
    off();
    setCloseWarning('x');
    expect(opened).toBe(false);
  });
});
