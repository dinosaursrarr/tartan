// Package api provides an API for tartans as a service.
package api

import (
	"bytes"
	"errors"
	"fmt"
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

const maxDimension = 512

// Handler providers the API interface.
type Handler struct {
	imageCache ImageCache
	wovenCache WovenCache
}

// NewHandler creates a new handler so we can serve the API.
func NewHandler(imageCache ImageCache, wovenCache WovenCache) *Handler {
	return &Handler{imageCache: imageCache, wovenCache: wovenCache}
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

	imageKey := imageCacheKey{pattern: pattern, format: format}
	if h.imageCache != nil {
		res, ok := h.imageCache.Get(imageKey)
		if ok {
			_ = serveBytes(w, res.bytes, res.contentType)
			return
		}
	}

	woven, colourCount, status, err := h.getWoven(pattern)
	if err != nil {
		log.Print(err.Error())
		http.Error(w, err.Error(), status)
		return
	}

	var imageEntry *imageCacheEntry
	switch format {
	case pngFormat:
		imageEntry = servePNG(w, woven)
	case gifFormat:
		imageEntry = serveGIF(w, woven, colourCount)
	case webpFormat:
		imageEntry = serveWEBP(w, woven)
	case unspecifiedImageFormat:
		log.Printf("unexpected state: encountered unspecified image format after parsing")
		http.Error(w, "image format problem", http.StatusInternalServerError)
		return
	}

	if h.imageCache != nil && imageEntry != nil {
		_ = h.imageCache.Add(imageKey, *imageEntry)
	}
}

var (
	errCannotParsePattern = errors.New("could not parse pattern")
	errCannotWeavePattern = errors.New("could not weave pattern")
	errTooWide            = fmt.Errorf("exceeds max width of %d", maxDimension)
	errTooTall            = fmt.Errorf("exceeds max height of %d", maxDimension)
)

func (h *Handler) getWoven(pattern string) (image.Image, int, int, error) {
	if h.wovenCache != nil {
		res, ok := h.wovenCache.Get(pattern)
		if ok {
			return res.img, res.colourCount, http.StatusOK, nil
		}
	}

	sett, err := parse.Parse(pattern)
	if err != nil {
		return nil, 0, http.StatusBadRequest, errCannotParsePattern
	}
	width := sett.Warp.Length()
	if width > maxDimension {
		return nil, 0, http.StatusBadRequest, errTooWide
	}
	height := sett.Weft.Length()
	if height > maxDimension {
		return nil, 0, http.StatusBadRequest, errTooTall
	}

	woven, err := weave.Tartan(sett, weave.CrossTwill)
	if err != nil {
		return nil, 0, http.StatusInternalServerError, errCannotWeavePattern
	}
	colourCount := len(sett.Palette())
	if h.wovenCache != nil {
		h.wovenCache.Add(pattern, wovenCacheEntry{img: woven, colourCount: colourCount})
	}
	return woven, colourCount, http.StatusOK, nil
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

func servePNG(w http.ResponseWriter, img image.Image) *imageCacheEntry {
	b := new(bytes.Buffer)
	err := png.Encode(b, img)
	if err != nil {
		log.Printf("could not encode png: %v", err)
		http.Error(w, "could not encode png", http.StatusInternalServerError)
		return nil
	}
	return serveBytes(w, b.Bytes(), "image/png")
}

func serveGIF(w http.ResponseWriter, img image.Image, colourCount int) *imageCacheEntry {
	b := new(bytes.Buffer)
	err := gif.Encode(b, img, &gif.Options{NumColors: colourCount})
	if err != nil {
		log.Printf("could not encode gif: %v", err)
		http.Error(w, "could not encode gif", http.StatusInternalServerError)
		return nil
	}
	return serveBytes(w, b.Bytes(), "image/gif")
}

func serveWEBP(w http.ResponseWriter, img image.Image) *imageCacheEntry {
	b := new(bytes.Buffer)
	err := nativewebp.Encode(b, img, nil)
	if err != nil {
		log.Printf("could not encode webp: %v", err)
		http.Error(w, "could not encode webp", http.StatusInternalServerError)
		return nil
	}
	return serveBytes(w, b.Bytes(), "image/webp")
}

func serveBytes(w http.ResponseWriter, b []byte, contentType string) *imageCacheEntry {
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	_, err := w.Write(b)
	if err != nil {
		log.Printf("failed to send response: %v", err)
	}
	return &imageCacheEntry{bytes: b, contentType: contentType}
}
