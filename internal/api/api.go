// Package api provides an API for tartans as a service.
package api

import (
	"bytes"
	"image"
	"image/gif"
	"image/png"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/HugoSmits86/nativewebp"

	"sett.fyi/tartan/internal/parse"
	"sett.fyi/tartan/internal/weave"
)

const maxDimension = 1024

// Handler providers the API interface.
type Handler struct {
	cache Cache
}

// NewHandler creates a new handler so we can serve the API.
func NewHandler(cache Cache) *Handler {
	return &Handler{cache: cache}
}

// Handle parses an incoming request and returns a rendered image.
func (h *Handler) Handle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		log.Printf("bad request: had method %v", r.Method)
		w.Header().Set("Allow", "GET")
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	params := r.URL.Query()

	pattern := params.Get("pattern")
	formatParam := params.Get("format")
	if formatParam == "" {
		formatParam = "png"
	}
	format, ok := parseFormat(formatParam)
	if !ok {
		log.Printf("bad request: could not parse format %v", formatParam)
		http.Error(w, "could not parse format", http.StatusBadRequest)
		return
	}

	cacheKey := cacheKey{pattern: pattern, format: format}
	if h.cache != nil {
		res, ok := h.cache.Get(cacheKey)
		if ok {
			_ = serveBytes(w, res.bytes, res.contentType)
			return
		}
	}

	sett, err := parse.Parse(pattern)
	if err != nil {
		log.Printf("bad request: could not parse pattern: %v", err)
		http.Error(w, "could not parse pattern", http.StatusBadRequest)
		return
	}
	width := sett.Warp.Length()
	if width > maxDimension {
		log.Printf("bad request: too wide at %d", width)
		http.Error(w, "exceeds max width of "+strconv.Itoa(maxDimension), http.StatusBadRequest)
		return
	}
	height := sett.Weft.Length()
	if height > maxDimension {
		log.Printf("bad request: too tall at %d", height)
		http.Error(w, "exceeds max height of "+strconv.Itoa(maxDimension), http.StatusBadRequest)
		return
	}

	woven, err := weave.Tartan(sett, weave.CrossTwill)
	if err != nil {
		log.Printf("could not weave pattern: %v", err)
		http.Error(w, "could not weave pattern", http.StatusInternalServerError)
		return
	}

	var cacheEntry *cacheEntry
	switch format {
	case pngFormat:
		cacheEntry = servePNG(w, woven)
	case gifFormat:
		cacheEntry = serveGIF(w, woven, len(sett.Palette()))
	case webpFormat:
		cacheEntry = serveWEBP(w, woven)
	case unspecifiedImageFormat:
		log.Printf("unexpected state: encountered unspecified image format after parsing")
		http.Error(w, "image format problem", http.StatusInternalServerError)
		return
	}

	if h.cache != nil && cacheEntry != nil {
		_ = h.cache.Add(cacheKey, *cacheEntry)
	}
}

type imageFormat int

const (
	unspecifiedImageFormat imageFormat = iota
	pngFormat
	gifFormat
	webpFormat
)

func parseFormat(format string) (imageFormat, bool) {
	switch strings.TrimSpace(strings.ToLower(format)) {
	case "png":
		return pngFormat, true
	case "gif":
		return gifFormat, true
	case "webp":
		return webpFormat, true
	}
	return unspecifiedImageFormat, false
}

func servePNG(w http.ResponseWriter, img image.Image) *cacheEntry {
	b := new(bytes.Buffer)
	err := png.Encode(b, img)
	if err != nil {
		log.Printf("could not encode png: %v", err)
		http.Error(w, "could not encode png", http.StatusInternalServerError)
		return nil
	}
	return serveBytes(w, b.Bytes(), "image/png")
}

func serveGIF(w http.ResponseWriter, img image.Image, colourCount int) *cacheEntry {
	b := new(bytes.Buffer)
	err := gif.Encode(b, img, &gif.Options{NumColors: colourCount})
	if err != nil {
		log.Printf("could not encode gif: %v", err)
		http.Error(w, "could not encode gif", http.StatusInternalServerError)
		return nil
	}
	return serveBytes(w, b.Bytes(), "image/gif")
}

func serveWEBP(w http.ResponseWriter, img image.Image) *cacheEntry {
	b := new(bytes.Buffer)
	err := nativewebp.Encode(b, img, nil)
	if err != nil {
		log.Printf("could not encode webp: %v", err)
		http.Error(w, "could not encode webp", http.StatusInternalServerError)
		return nil
	}
	return serveBytes(w, b.Bytes(), "image/webp")
}

func serveBytes(w http.ResponseWriter, b []byte, contentType string) *cacheEntry {
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	_, err := w.Write(b)
	if err != nil {
		log.Printf("failed to send response: %v", err)
	}
	return &cacheEntry{bytes: b, contentType: contentType}
}
