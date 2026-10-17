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

// Handle parses an incoming request and returns a rendered image.
func Handle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		log.Printf("bad request: had method %v", r.Method)
		w.Header().Set("Allow", "GET")
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	params := r.URL.Query()

	pattern := params.Get("pattern")
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

	formatParam := params.Get("format")
	if formatParam == "" {
		formatParam = "png"
	}
	format, ok := parseFormat(formatParam)
	if !ok {
		log.Printf("bad request: could not parse format: %v", err)
		http.Error(w, "could not parse format", http.StatusBadRequest)
		return
	}

	woven, err := weave.Tartan(sett, weave.CrossTwill)
	if err != nil {
		log.Printf("could not weave pattern: %v", err)
		http.Error(w, "could not weave pattern", http.StatusInternalServerError)
		return
	}

	switch format {
	case pngFormat:
		servePNG(w, woven)
	case gifFormat:
		serveGIF(w, woven, len(sett.Palette()))
	case webpFormat:
		serveWEBP(w, woven)
	case unspecifiedImageFormat:
		log.Printf("unexpected state: encountered unspecified image format after parsing")
		http.Error(w, "image format problem", http.StatusInternalServerError)
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

func servePNG(w http.ResponseWriter, img image.Image) {
	b := new(bytes.Buffer)
	err := png.Encode(b, img)
	if err != nil {
		log.Printf("could not encode png: %v", err)
		http.Error(w, "could not encode png", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Length", strconv.Itoa(b.Len()))
	_, err = w.Write(b.Bytes())
	if err != nil {
		log.Printf("failed to send png response: %v", err)
	}
}

func serveGIF(w http.ResponseWriter, img image.Image, colourCount int) {
	b := new(bytes.Buffer)
	err := gif.Encode(b, img, &gif.Options{NumColors: colourCount})
	if err != nil {
		log.Printf("could not encode gif: %v", err)
		http.Error(w, "could not encode gif", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "image/gif")
	w.Header().Set("Content-Length", strconv.Itoa(b.Len()))
	_, err = w.Write(b.Bytes())
	if err != nil {
		log.Printf("failed to send gif response: %v", err)
	}
}

func serveWEBP(w http.ResponseWriter, img image.Image) {
	b := new(bytes.Buffer)
	err := nativewebp.Encode(b, img, nil)
	if err != nil {
		log.Printf("could not encode webp: %v", err)
		http.Error(w, "could not encode webp", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "image/webp")
	w.Header().Set("Content-Length", strconv.Itoa(b.Len()))
	_, err = w.Write(b.Bytes())
	if err != nil {
		log.Printf("failed to send webp response: %v", err)
	}
}
