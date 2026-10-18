package api

import (
	"net/http"
	"path/filepath"
)

// StaticHandler serves files over HTTP.
type StaticHandler struct {
	fs           http.Handler
	indexContent func(w http.ResponseWriter, r *http.Request)
}

// NewStaticHandler serves the folder at the path. For the index, we serve the file within indexPath,
// which should be relative to path.
func NewStaticHandler(path string, indexPath string) *StaticHandler {
	fs := http.FileServer(http.Dir(path))
	return &StaticHandler{
		fs: fs,
		indexContent: func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, filepath.Join(path, indexPath))
		},
	}
}

// ServeHTTP serves files from the static folder.
func (h *StaticHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/" {
		h.indexContent(w, r)
		return
	}
	h.fs.ServeHTTP(w, r)
}
