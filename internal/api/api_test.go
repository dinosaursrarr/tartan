package api

import (
	"bytes"
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

			handler := NewHandler(nil)
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

	handler := NewHandler(nil)
	response := performRequest(handler, http.MethodPost, "a#112233[a1", "png")

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

			handler := NewHandler(nil)
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

	handler := NewHandler(nil)
	response := performRequest(handler, http.MethodGet, "a#112233[a1", "jpg")
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
			pattern: "a#112233[a1025]a1",
			wantErr: "max width",
		},
		{
			name:    "too many weft threads",
			pattern: "a#112233[a1]a1025",
			wantErr: "max height",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			handler := NewHandler(nil)
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
	cache := NewCache(8, time.Minute)
	handler := NewHandler(cache)
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

		key := cacheKey{pattern: pattern, format: test.cacheFormat}
		entry, ok := cache.Get(key)
		if !ok {
			t.Fatalf("cache has no entry for %s", test.name)
		}
		if entry.contentType != test.contentType {
			t.Errorf("cached content type = %q, want %q", entry.contentType, test.contentType)
		}
		if !bytes.Equal(entry.bytes, response.Body.Bytes()) {
			t.Errorf("cached bytes do not match the first %s response", test.name)
		}

		// A repeat request should take the cache-hit path and return the same
		// encoded representation without changing the cache entry.
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

	for _, test := range tests {
		key := cacheKey{pattern: pattern, format: test.cacheFormat}
		entry, ok := cache.Get(key)
		if !ok {
			t.Errorf("cache has no entry for format %v after requests", test.cacheFormat)
			continue
		}
		if entry.contentType != test.contentType {
			t.Errorf("cached content type for %v = %q, want %q", test.cacheFormat, entry.contentType, test.contentType)
		}
	}
}

func TestHandleDoesNotCacheRejectedResponses(t *testing.T) {
	t.Parallel()

	cache := NewCache(8, time.Minute)
	handler := NewHandler(cache)
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
			pattern: "a#112233[a1025]a1",
		},
		{
			name:    "weft over limit",
			pattern: "a#112233[a1]a1025",
		},
	}

	for _, test := range tests {
		response := performRequest(handler, http.MethodGet, test.pattern, "")
		if response.Code != http.StatusBadRequest {
			t.Fatalf("%s: status = %d, want %d", test.name, response.Code, http.StatusBadRequest)
		}

		key := cacheKey{pattern: test.pattern, format: pngFormat}
		_, ok := cache.Get(key)
		if ok {
			t.Errorf("%s: rejected response was cached", test.name)
		}
	}
}

func TestHandleCacheEntriesExpire(t *testing.T) {
	t.Parallel()

	cache := NewCache(2, 100*time.Millisecond)
	handler := NewHandler(cache)
	pattern := "a#112233[a1"
	key := cacheKey{pattern: pattern, format: pngFormat}

	firstResponse := performRequest(handler, http.MethodGet, pattern, "")
	assertSuccessfulImageResponse(t, firstResponse, "image/png")

	time.Sleep(150 * time.Millisecond)
	_, ok := cache.Get(key)
	if ok {
		t.Fatal("cache entry is still present after its TTL elapsed")
	}

	secondResponse := performRequest(handler, http.MethodGet, pattern, "")
	assertSuccessfulImageResponse(t, secondResponse, "image/png")
	if !bytes.Equal(firstResponse.Body.Bytes(), secondResponse.Body.Bytes()) {
		t.Fatal("response after cache expiry differs from initial response")
	}

	_, ok = cache.Get(key)
	if !ok {
		t.Fatal("cache does not contain an entry after the request refreshed it")
	}
}

func TestHandleCacheEvictsOldEntriesWhenFull(t *testing.T) {
	t.Parallel()

	cache := NewCache(1, time.Minute)
	handler := NewHandler(cache)
	firstPattern := "a#112233[a1"
	secondPattern := "a#112233[a2"

	firstResponse := performRequest(handler, http.MethodGet, firstPattern, "")
	assertSuccessfulImageResponse(t, firstResponse, "image/png")
	secondResponse := performRequest(handler, http.MethodGet, secondPattern, "")
	assertSuccessfulImageResponse(t, secondResponse, "image/png")

	_, firstOK := cache.Get(cacheKey{pattern: firstPattern, format: pngFormat})
	if firstOK {
		t.Fatal("first cache entry is still present after capacity was exceeded")
	}
	_, secondOK := cache.Get(cacheKey{pattern: secondPattern, format: pngFormat})
	if !secondOK {
		t.Fatal("cache does not contain the most recent entry")
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
