// The Wails desktop shell (desktop/). It binds its Go methods at window.go.main.App
// before any page script runs; in a browser there is none, and every caller keeps its
// web behaviour. Bytes cross the bridge as base64, the JSON form of Go's []byte.

type RawFile = { name: string; data: string | null };

type Bridge = {
  SaveFile(suggestedName: string, description: string, pattern: string, data: string): Promise<string>;
  LaunchFile(): Promise<RawFile | null>;
  SetCloseWarning(message: string): Promise<void>;
};

type WailsWindow = Window & {
  go?: { main?: { App?: Bridge } };
  runtime?: { EventsOn(name: string, callback: (data: RawFile) => void): () => void };
};

const bridge: Bridge | null = (window as WailsWindow).go?.main?.App ?? null;

export const isDesktop = bridge !== null;

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

// The shell's own save dialog, for webviews without showSaveFilePicker (macOS, Linux).
// Throws AbortError when cancelled, as the picker does.
export async function desktopSave(bytes: Uint8Array, suggestedName: string, description: string, ext: string): Promise<void> {
  if (!(await bridge!.SaveFile(suggestedName, description, `*.${ext}`, toBase64(bytes)))) {
    throw new DOMException('Save cancelled', 'AbortError');
  }
}

// Documents the OS hands the app: the one it was started with, then each one
// double-clicked while it runs. Returns the unsubscribe.
export function onDesktopFile(open: (bytes: Uint8Array, name: string) => void): () => void {
  if (!bridge) return () => {};
  const take = (f: RawFile | null) => f && open(fromBase64(f.data ?? ''), f.name);
  void bridge.LaunchFile().then(take);
  return (window as WailsWindow).runtime!.EventsOn('open-file', take);
}

// The window-close prompt's text while closing would lose work; '' clears it.
export function setCloseWarning(message: string): void {
  void bridge?.SetCloseWarning(message);
}
