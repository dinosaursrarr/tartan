package api

import (
	"bytes"
	"image"
	"image/color"
	"image/gif"
	"image/png"
	"mime"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"
)

const commonPattern = "a#112233[a1"

func TestHandleSuccessfulFormats(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		format   string
		wantType string
	}{
		{
			name:     "default format is PNG",
			wantType: "image/png",
		},
		{
			name:     "PNG",
			format:   "png",
			wantType: "image/png",
		},
		{
			name:     "GIF",
			format:   "gif",
			wantType: "image/gif",
		},
		{
			name:     "WEBP",
			format:   "webp",
			wantType: "image/webp",
		},
		{
			name:     "format is case insensitive and trimmed",
			format:   " GIF ",
			wantType: "image/gif",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			handler := NewHandler(nil, nil)
			response := performRequest(handler, http.MethodGet, "a#FF0000b#00FF00[a1]b1", test.format)

			assertSuccessfulImageResponse(t, response, test.wantType)

			switch test.wantType {
			case "image/png":
				img, err := png.Decode(bytes.NewReader(response.Body.Bytes()))
				if err != nil {
					t.Fatalf("PNG body does not decode: %v", err)
				}
				assertImageDimensions(t, img.Bounds().Dx(), img.Bounds().Dy(), 2, 2)
			case "image/gif":
				img, err := gif.Decode(bytes.NewReader(response.Body.Bytes()))
				if err != nil {
					t.Fatalf("GIF body does not decode: %v", err)
				}
				assertImageDimensions(t, img.Bounds().Dx(), img.Bounds().Dy(), 2, 2)
			case "image/webp":
				body := response.Body.Bytes()
				if len(body) < 12 {
					t.Fatalf("WEBP body is too short: %d bytes", len(body))
				}
				if string(body[:4]) != "RIFF" || string(body[8:12]) != "WEBP" {
					t.Fatalf("WEBP body has invalid container signature: %q", body[:12])
				}
			}
		})
	}
}

func TestHandleRejectsNonGETMethod(t *testing.T) {
	t.Parallel()

	handler := NewHandler(nil, nil)
	response := performRequest(handler, http.MethodPost, commonPattern, "png")

	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("Handle() status = %d, want %d", response.Code, http.StatusMethodNotAllowed)
	}
	if got := response.Header().Get("Allow"); got != http.MethodGet {
		t.Fatalf("Allow header = %q, want %q", got, http.MethodGet)
	}
}

func TestHandleRejectsInvalidPatterns(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		pattern string
	}{
		{
			name:    "missing pattern",
			pattern: "",
		},
		{
			name:    "undefined colour reference",
			pattern: "a#112233[b1",
		},
		{
			name:    "unexpected trailing character",
			pattern: "a#112233[a1!",
		},
		{
			name:    "zero thread count",
			pattern: "a#112233[a0",
		},
		{
			name:    "space between thread blocks",
			pattern: "a#112233[a1 b1",
		},
		{
			name:    "space between warp and weft",
			pattern: "a#112233[a1] b1",
		},
		{
			name:    "unexpected percent sequence",
			pattern: "a#112233[a1%ZZ",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			handler := NewHandler(nil, nil)
			response := performRequest(handler, http.MethodGet, test.pattern, "")
			if response.Code != http.StatusBadRequest {
				t.Fatalf(
					"Handle() status = %d, want %d; body = %q",
					response.Code,
					http.StatusBadRequest,
					response.Body.String(),
				)
			}
		})
	}
}

func TestHandleRejectsUnsupportedFormat(t *testing.T) {
	t.Parallel()

	handler := NewHandler(nil, nil)
	response := performRequest(handler, http.MethodGet, commonPattern, "jpg")
	if response.Code != http.StatusBadRequest {
		t.Fatalf(
			"Handle() status = %d, want %d; body = %q",
			response.Code,
			http.StatusBadRequest,
			response.Body.String(),
		)
	}
	if !strings.Contains(response.Body.String(), "could not parse format") {
		t.Fatalf("response body = %q, want format error", response.Body.String())
	}
}

func TestHandleRejectsThreadsOverMaximumDimension(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		pattern string
		wantErr string
	}{
		{
			name:    "too many warp threads",
			pattern: "a#112233[a513]a1",
			wantErr: "max width",
		},
		{
			name:    "too many weft threads",
			pattern: "a#112233[a1]a513",
			wantErr: "max height",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			handler := NewHandler(nil, nil)
			response := performRequest(handler, http.MethodGet, test.pattern, "")
			if response.Code != http.StatusBadRequest {
				t.Fatalf(
					"Handle() status = %d, want %d; body = %q",
					response.Code,
					http.StatusBadRequest,
					response.Body.String(),
				)
			}
			if !strings.Contains(response.Body.String(), test.wantErr) {
				t.Fatalf("response body = %q, want it to contain %q", response.Body.String(), test.wantErr)
			}
		})
	}
}

func TestHandleCachesResponsesByFormat(t *testing.T) {
	t.Parallel()

	pattern := "a#FF0000b#00FF00[a1]b1"
	imageCache := NewImageCache(8, time.Minute)
	wovenCache := NewWovenCache(8, time.Minute)
	handler := NewHandler(imageCache, wovenCache)

	tests := []struct {
		name        string
		format      string
		cacheFormat imageFormat
		contentType string
	}{
		{
			name:        "default PNG",
			cacheFormat: pngFormat,
			contentType: "image/png",
		},
		{
			name:        "GIF",
			format:      "gif",
			cacheFormat: gifFormat,
			contentType: "image/gif",
		},
		{
			name:        "WEBP",
			format:      "webp",
			cacheFormat: webpFormat,
			contentType: "image/webp",
		},
	}

	for _, test := range tests {
		response := performRequest(handler, http.MethodGet, pattern, test.format)
		assertSuccessfulImageResponse(t, response, test.contentType)

		key := imageCacheKey{pattern: pattern, format: test.cacheFormat}
		entry, ok := imageCache.Get(key)
		if !ok {
			t.Fatalf("image cache has no entry for %s", test.name)
		}
		if entry.contentType != test.contentType {
			t.Errorf("cached content type = %q, want %q", entry.contentType, test.contentType)
		}
		if !bytes.Equal(entry.bytes, response.Body.Bytes()) {
			t.Errorf("cached bytes do not match the first %s response", test.name)
		}

		repeatFormat := test.format
		if test.cacheFormat == pngFormat {
			repeatFormat = " PNG "
		}
		repeat := performRequest(handler, http.MethodGet, pattern, repeatFormat)
		assertSuccessfulImageResponse(t, repeat, test.contentType)
		if !bytes.Equal(repeat.Body.Bytes(), entry.bytes) {
			t.Errorf("repeated %s response does not match cached bytes", test.name)
		}
	}

	woven, ok := wovenCache.Get(pattern)
	if !ok {
		t.Fatal("woven cache does not contain the pattern after successful requests")
	}
	if woven.img == nil {
		t.Fatal("cached woven image is nil")
	}
	if woven.colourCount != 2 {
		t.Errorf("cached colour count = %d, want 2", woven.colourCount)
	}
	assertImageDimensions(t, woven.img.Bounds().Dx(), woven.img.Bounds().Dy(), 2, 2)
}

func TestHandleUsesWovenCacheOnImageCacheMiss(t *testing.T) {
	t.Parallel()

	pattern := commonPattern
	cachedColour := color.RGBA{R: 0x12, G: 0x34, B: 0x56, A: 0xff}
	cachedImage := image.NewRGBA(image.Rect(0, 0, 2, 2))
	for y := range 2 {
		for x := range 2 {
			cachedImage.Set(x, y, cachedColour)
		}
	}

	wovenCache := NewWovenCache(2, time.Minute)
	wovenCache.Add(pattern, wovenCacheEntry{img: cachedImage, colourCount: 1})
	handler := NewHandler(nil, wovenCache)
	response := performRequest(handler, http.MethodGet, pattern, "png")
	assertSuccessfulImageResponse(t, response, "image/png")

	decoded, err := png.Decode(bytes.NewReader(response.Body.Bytes()))
	if err != nil {
		t.Fatalf("PNG body does not decode: %v", err)
	}
	assertColour(t, decoded.At(0, 0), cachedColour)
}

func TestHandleDoesNotCacheRejectedResponses(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		pattern string
	}{
		{
			name:    "invalid pattern",
			pattern: "a#112233[a0",
		},
		{
			name:    "warp over limit",
			pattern: "a#112233[a513]a1",
		},
		{
			name:    "weft over limit",
			pattern: "a#112233[a1]a513",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			imageCache := NewImageCache(8, time.Minute)
			wovenCache := NewWovenCache(8, time.Minute)
			handler := NewHandler(imageCache, wovenCache)
			response := performRequest(handler, http.MethodGet, test.pattern, "")
			if response.Code != http.StatusBadRequest {
				t.Fatalf("Handle() status = %d, want %d", response.Code, http.StatusBadRequest)
			}

			_, imageOK := imageCache.Get(imageCacheKey{pattern: test.pattern, format: pngFormat})
			if imageOK {
				t.Error("rejected response was stored in the image cache")
			}
			_, wovenOK := wovenCache.Get(test.pattern)
			if wovenOK {
				t.Error("rejected response was stored in the woven cache")
			}
		})
	}
}

func TestHandleCacheEntriesExpire(t *testing.T) {
	t.Parallel()

	ttl := 100 * time.Millisecond
	imageCache := NewImageCache(2, ttl)
	wovenCache := NewWovenCache(2, ttl)
	handler := NewHandler(imageCache, wovenCache)
	pattern := commonPattern
	imageKey := imageCacheKey{pattern: pattern, format: pngFormat}

	firstResponse := performRequest(handler, http.MethodGet, pattern, "")
	assertSuccessfulImageResponse(t, firstResponse, "image/png")

	_, imageOK := imageCache.Get(imageKey)
	if !imageOK {
		t.Fatal("image cache does not contain an entry after the request")
	}
	_, wovenOK := wovenCache.Get(pattern)
	if !wovenOK {
		t.Fatal("woven cache does not contain an entry after the request")
	}

	time.Sleep(150 * time.Millisecond)
	_, imageOK = imageCache.Get(imageKey)
	if imageOK {
		t.Fatal("image cache entry is still present after its TTL elapsed")
	}
	_, wovenOK = wovenCache.Get(pattern)
	if wovenOK {
		t.Fatal("woven cache entry is still present after its TTL elapsed")
	}

	secondResponse := performRequest(handler, http.MethodGet, pattern, "")
	assertSuccessfulImageResponse(t, secondResponse, "image/png")
	if !bytes.Equal(firstResponse.Body.Bytes(), secondResponse.Body.Bytes()) {
		t.Fatal("response after cache expiry differs from initial response")
	}

	_, imageOK = imageCache.Get(imageKey)
	if !imageOK {
		t.Fatal("image cache does not contain an entry after the request refreshed it")
	}
	_, wovenOK = wovenCache.Get(pattern)
	if !wovenOK {
		t.Fatal("woven cache does not contain an entry after the request refreshed it")
	}
}

func TestHandleCachesEvictOldEntriesWhenFull(t *testing.T) {
	t.Parallel()

	imageCache := NewImageCache(1, time.Minute)
	wovenCache := NewWovenCache(1, time.Minute)
	handler := NewHandler(imageCache, wovenCache)
	firstPattern := commonPattern
	secondPattern := "a#112233[a2"

	firstResponse := performRequest(handler, http.MethodGet, firstPattern, "")
	assertSuccessfulImageResponse(t, firstResponse, "image/png")
	secondResponse := performRequest(handler, http.MethodGet, secondPattern, "")
	assertSuccessfulImageResponse(t, secondResponse, "image/png")

	_, firstImageOK := imageCache.Get(imageCacheKey{pattern: firstPattern, format: pngFormat})
	if firstImageOK {
		t.Fatal("first image cache entry is still present after capacity was exceeded")
	}
	_, secondImageOK := imageCache.Get(imageCacheKey{pattern: secondPattern, format: pngFormat})
	if !secondImageOK {
		t.Fatal("image cache does not contain the most recent entry")
	}

	_, firstWovenOK := wovenCache.Get(firstPattern)
	if firstWovenOK {
		t.Fatal("first woven cache entry is still present after capacity was exceeded")
	}
	_, secondWovenOK := wovenCache.Get(secondPattern)
	if !secondWovenOK {
		t.Fatal("woven cache does not contain the most recent entry")
	}
}

func performRequest(handler *Handler, method string, pattern string, format string) *httptest.ResponseRecorder {
	values := url.Values{}
	values.Set("pattern", pattern)
	if format != "" {
		values.Set("format", format)
	}

	request := httptest.NewRequest(method, "/?"+values.Encode(), nil)
	response := httptest.NewRecorder()
	handler.Handle(response, request)
	return response
}

func assertSuccessfulImageResponse(t *testing.T, response *httptest.ResponseRecorder, wantType string) {
	t.Helper()

	if response.Code != http.StatusOK {
		t.Fatalf("Handle() status = %d, want %d; body = %q", response.Code, http.StatusOK, response.Body.String())
	}

	contentType, _, err := mime.ParseMediaType(response.Header().Get("Content-Type"))
	if err != nil {
		t.Fatalf("Content-Type is invalid: %v", err)
	}
	if contentType != wantType {
		t.Fatalf("Content-Type = %q, want %q", contentType, wantType)
	}
	if response.Body.Len() == 0 {
		t.Fatal("response body is empty")
	}

	contentLength, err := strconv.Atoi(response.Header().Get("Content-Length"))
	if err != nil {
		t.Fatalf("Content-Length is invalid: %v", err)
	}
	if contentLength != response.Body.Len() {
		t.Fatalf("Content-Length = %d, body length = %d", contentLength, response.Body.Len())
	}
}

func assertImageDimensions(t *testing.T, gotWidth int, gotHeight int, wantWidth int, wantHeight int) {
	t.Helper()

	if gotWidth != wantWidth || gotHeight != wantHeight {
		t.Fatalf("image dimensions = %dx%d, want %dx%d", gotWidth, gotHeight, wantWidth, wantHeight)
	}
}

func assertColour(t *testing.T, got color.Color, want color.Color) {
	t.Helper()

	gotR, gotG, gotB, gotA := got.RGBA()
	wantR, wantG, wantB, wantA := want.RGBA()
	if gotR != wantR || gotG != wantG || gotB != wantB || gotA != wantA {
		t.Fatalf("colour = RGBA(%04x,%04x,%04x,%04x), want RGBA(%04x,%04x,%04x,%04x)",
			gotR, gotG, gotB, gotA, wantR, wantG, wantB, wantA)
	}
}
