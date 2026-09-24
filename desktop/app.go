package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// OpenedFile is a document handed to the page; Data travels as base64 in JSON.
type OpenedFile struct {
	Name string `json:"name"`
	Data []byte `json:"data"`
}

// App is bound to the page as window.go.main.App (src/lib/utils/desktop.ts).
type App struct {
	ctx          context.Context
	mu           sync.Mutex
	launchPath   string // the document the app was started with, until the page takes it
	pageReady    bool   // the page has asked for launchPath, so later documents go by event
	closeWarning string // the page's localized warning; empty while closing loses nothing
}

func NewApp(args []string) *App {
	return &App{launchPath: documentArg(args, "")}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// documentArg is the first argument naming an existing file, which is how the OS
// passes a double-clicked document; relative paths resolve against dir.
func documentArg(args []string, dir string) string {
	for _, arg := range args {
		if dir != "" && !filepath.IsAbs(arg) {
			arg = filepath.Join(dir, arg)
		}
		if st, err := os.Stat(arg); err == nil && !st.IsDir() {
			return arg
		}
	}
	return ""
}

func readDocument(path string) (*OpenedFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return &OpenedFile{Name: filepath.Base(path), Data: data}, nil
}

// LaunchFile returns the document the app was started with, once.
func (a *App) LaunchFile() (*OpenedFile, error) {
	a.mu.Lock()
	path := a.launchPath
	a.launchPath = ""
	a.pageReady = true
	a.mu.Unlock()
	if path == "" {
		return nil, nil
	}
	return readDocument(path)
}

// openDocument hands a document to the page: kept for LaunchFile while the page is
// still loading, sent as an "open-file" event once it listens.
func (a *App) openDocument(path string) {
	a.mu.Lock()
	if !a.pageReady {
		a.launchPath = path
		a.mu.Unlock()
		return
	}
	a.mu.Unlock()
	file, err := readDocument(path)
	if err != nil {
		println("Error:", err.Error())
		return
	}
	runtime.EventsEmit(a.ctx, "open-file", file)
}

func (a *App) secondInstance(data options.SecondInstanceData) {
	runtime.WindowUnminimise(a.ctx)
	runtime.WindowShow(a.ctx)
	if path := documentArg(data.Args, data.WorkingDirectory); path != "" {
		a.openDocument(path)
	}
}

// SaveFile asks where to save and writes data there. It returns the file's name, or ""
// when the dialog is cancelled; pattern is the one extension offered, as "*.odt".
func (a *App) SaveFile(suggestedName, description, pattern string, data []byte) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename:      suggestedName,
		Filters:              []runtime.FileFilter{{DisplayName: description, Pattern: pattern}},
		CanCreateDirectories: true,
	})
	if err != nil || path == "" {
		return "", err
	}
	if ext := strings.TrimPrefix(pattern, "*"); !strings.EqualFold(filepath.Ext(path), ext) {
		path += ext
	}
	return filepath.Base(path), os.WriteFile(path, data, 0o644)
}

// SetCloseWarning is called by the page whenever closing would lose work.
func (a *App) SetCloseWarning(message string) {
	a.mu.Lock()
	a.closeWarning = message
	a.mu.Unlock()
}

// beforeClose stands in for the browser's beforeunload prompt, which a closing
// desktop window never shows. A dialog that fails lets the window close.
func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	a.mu.Lock()
	message := a.closeWarning
	a.mu.Unlock()
	if message == "" {
		return false
	}
	answer, err := runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "EdenText",
		Message:       message,
		Buttons:       []string{"Yes", "No"},
		DefaultButton: "No",
	})
	return err == nil && answer != "Yes"
}
