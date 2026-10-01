import { describe, it, expect, vi } from 'vitest';
import { pickSlot } from '../../src/lib/storage/docScope';

const NOW = 1_700_000_000_000;
const MIN = 60_000;

describe('pickSlot', () => {
  it('gives the first tab of any browser the unsuffixed slot', () => {
    expect(pickSlot({}, NOW)).toBe('');
  });

  it('mints a new document while every one is held', () => {
    const id = pickSlot({ '': NOW - 1000 }, NOW);
    // Minted in the same millisecond, the next one still steers clear of it.
    expect(id).not.toBe('');
    for (let i = 0; i < 2e4; i++) expect(pickSlot({ '': NOW - 1000, [id]: NOW }, NOW)).not.toBe(id);
  });

  it('starts every later fresh tab on a new document, free ones or not', () => {
    const id = pickSlot({ '': -(NOW - 9 * MIN), d2: NOW - 11 * MIN }, NOW);
    expect(['', 'd2']).not.toContain(id);
  });
});

describe('deleteDocument', () => {
  it('drops the first document by its registered names and another by its suffix', async () => {
    localStorage.clear();
    sessionStorage.setItem('edentext-tab-doc', 'd9');
    vi.resetModules();
    const scope = await import('../../src/lib/storage/docScope');
    scope.docKey('edentext-doc');
    const released = String(-(Date.now() - MIN));
    localStorage.setItem('edentext-live@', released);
    localStorage.setItem('edentext-doc', '{"content":[{"text":"Erstes"}]}');
    localStorage.setItem('edentext-live@d1', released);
    localStorage.setItem('edentext-doc@d1', '{"content":[{"text":"Hallo"}]}');
    localStorage.setItem('edentext-theme', 'dark');

    expect((await scope.listDocuments()).map((d) => [d.id, d.mine, d.label])).toEqual([
      ['d9', true, ''], ['', false, 'Erstes'], ['d1', false, 'Hallo'],
    ]);
    await scope.deleteDocument('');
    await scope.deleteDocument('d1');
    await scope.deleteDocument('d9'); // the open one stays
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    expect(keys.sort()).toEqual(['edentext-live@d9', 'edentext-theme']);
  });

  it('prunes the empty documents no tab holds, and lists none of them', async () => {
    localStorage.clear();
    sessionStorage.setItem('edentext-tab-doc', 'd9');
    vi.resetModules();
    const scope = await import('../../src/lib/storage/docScope');
    const released = String(-(Date.now() - MIN));
    localStorage.setItem('edentext-live@d1', released);
    localStorage.setItem('edentext-doc@d1', '{"content":[{"type":"paragraph"}]}');
    localStorage.setItem('edentext-live@d2', released);
    localStorage.setItem('edentext-live@d5', released);
    localStorage.setItem('edentext-footer@d5', '{"type":"doc"}');
    localStorage.setItem('edentext-live@d3', String(Date.now()));
    localStorage.setItem('edentext-live@d4', released);
    localStorage.setItem('edentext-doc@d4', '{"content":[{"type":"paragraph","content":[{"text":"x"}]}]}');
    expect((await scope.listDocuments()).map((d) => d.id).sort()).toEqual(['d3', 'd4', 'd5', 'd9']);
    await scope.pruneOldDocuments();
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    expect(keys.sort()).toEqual(['edentext-doc@d4', 'edentext-footer@d5', 'edentext-live@d3', 'edentext-live@d4', 'edentext-live@d5', 'edentext-live@d9']);
  });
});
