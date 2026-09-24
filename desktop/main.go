package main

import (
	"embed"
	"net/http"
	"os"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

// The Vite build, written here by wails.json's frontend:build.
//
//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp(os.Args[1:])
	err := wails.Run(&options.App{
		Title:  "EdenText",
		Width:  1280,
		Height: 900,
		AssetServer: &assetserver.Options{
			Assets: assets,
			// Wails' file server panics on a directory URL without an index.html, which
			// takes the window down; the build has none below the root, so any is a 404.
			Middleware: func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if r.URL.Path != "/" && strings.HasSuffix(r.URL.Path, "/") {
						http.NotFound(w, r)
						return
					}
					next.ServeHTTP(w, r)
				})
			},
		},
		OnStartup:     app.startup,
		OnBeforeClose: app.beforeClose,
		// A document double-clicked while the app runs opens in the running window.
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId:               "io.github.stffnb.edentext",
			OnSecondInstanceLaunch: app.secondInstance,
		},
		Mac:  &mac.Options{OnFileOpen: app.openDocument},
		Bind: []interface{}{app},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
