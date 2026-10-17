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
)

func TestHandleSuccessfulFormats(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		format      string
		wantType    string
		wantDefault bool
	}{
		{
			name:        "default format is PNG",
			wantType:    "image/png",
			wantDefault: true,
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

			values := url.Values{}
			values.Set("pattern", "a#FF0000b#00FF00[a1]b1")
			if !test.wantDefault {
				values.Set("format", test.format)
			}

			request := httptest.NewRequest(http.MethodGet, "/?"+values.Encode(), nil)
			response := httptest.NewRecorder()

			Handle(response, request)

			if response.Code != http.StatusOK {
				t.Fatalf(
					"Handle() status = %d, want %d; body = %q",
					response.Code,
					http.StatusOK,
					response.Body.String(),
				)
			}

			contentType, _, err := mime.ParseMediaType(response.Header().Get("Content-Type"))
			if err != nil {
				t.Fatalf("Content-Type is invalid: %v", err)
			}
			if contentType != test.wantType {
				t.Fatalf("Content-Type = %q, want %q", contentType, test.wantType)
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

			switch contentType {
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

	request := httptest.NewRequest(http.MethodPost, "/", nil)
	response := httptest.NewRecorder()

	Handle(response, request)

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
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			response := performRequest(http.MethodGet, test.pattern, "")
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

	response := performRequest(http.MethodGet, "a#112233[a1", "jpg")
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

			response := performRequest(http.MethodGet, test.pattern, "")
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

func TestHandleRejectsMalformedQueryEscape(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequest(http.MethodGet, "/?pattern=%25ZZ", nil)
	response := httptest.NewRecorder()

	Handle(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf(
			"Handle() status = %d, want %d; body = %q",
			response.Code,
			http.StatusBadRequest,
			response.Body.String(),
		)
	}
}

func performRequest(method string, pattern string, format string) *httptest.ResponseRecorder {
	values := url.Values{}
	values.Set("pattern", pattern)
	if format != "" {
		values.Set("format", format)
	}

	request := httptest.NewRequest(method, "/?"+values.Encode(), nil)
	response := httptest.NewRecorder()
	Handle(response, request)
	return response
}

func assertImageDimensions(t *testing.T, gotWidth int, gotHeight int, wantWidth int, wantHeight int) {
	t.Helper()

	if gotWidth != wantWidth || gotHeight != wantHeight {
		t.Fatalf("image dimensions = %dx%d, want %dx%d", gotWidth, gotHeight, wantWidth, wantHeight)
	}
}
