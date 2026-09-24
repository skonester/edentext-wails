# `desktop/`

The Wails v2 desktop app: a Go shell around the system webview (WebView2 on Windows,
WebKit on macOS and Linux) that embeds the Vite build. Needs Go and the `wails` CLI
(`go install github.com/wailsapp/wails/v2/cmd/wails@latest`); `wails doctor` checks the rest.

```bash
npm run desktop                  # wails dev against the Vite dev server
npm run build:desktop            # desktop/build/bin/edentext.exe
npm run build:desktop:installer  # plus an NSIS installer with file associations (needs makensis)
```

`wails.json` builds the page with `vite build --mode desktop` into `frontend/dist`, which
`main.go` embeds. That mode drops the visit counter, the manifest link and the service worker
(`vite.config.ts`, `main.ts`). Keep `info.productVersion` in step with `package.json`.
The manual `eden-go` workflow builds both Windows files into a `desktop-v<version>` draft release.

The page stays the web app. It is served from a fixed origin (`http://wails.localhost` on
Windows), so localStorage and IndexedDB persist in the webview profile under the executable's
name. `src/lib/utils/desktop.ts` is the whole bridge to `app.go`; nothing else calls Go:

- **Save** — WebView2 has `showSaveFilePicker`, so Windows keeps the web path with handles and
  recent files. Webviews without it save through `SaveFile`, which asks every time.
- **Open from the OS** — a document on the command line (double-click, file association) or
  from a second launch reaches the page through `LaunchFile` and the `open-file` event,
  without a handle, so its first Save asks where to write. macOS sends it via `OnFileOpen`.
- **Close** — a closing window never fires `beforeunload`'s prompt. The page's unsaved-work
  effect passes its localized text to `SetCloseWarning`, and `beforeClose` asks with it.

Wails' asset server panics on a directory URL that has no `index.html`, which kills the app;
the `main.go` middleware answers any such path with 404.
