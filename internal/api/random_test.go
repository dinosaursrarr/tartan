package api

import (
	"context"
	"math/rand/v2"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"
	"time"

	clock "k8s.io/utils/clock"
	clocktesting "k8s.io/utils/clock/testing"
)

func TestNewRandomHandlerLoadsCatalogue(t *testing.T) {
	t.Parallel()

	delegate := &recordingHTTPHandler{statusCode: http.StatusNoContent}
	handler, err := NewRandomHandler(clock.RealClock{}, delegate)
	if err != nil {
		t.Fatalf("NewRandomHandler() error = %v, want nil", err)
	}
	if len(handler.tartans) == 0 {
		t.Fatal("NewRandomHandler() loaded an empty catalogue")
	}
	for i, item := range handler.tartans {
		if item.Pattern == "" {
			t.Errorf("catalogue entry %d has an empty pattern", i)
		}
	}
}

func TestNewRandomHandlerRejectsNilDependencies(t *testing.T) {
	t.Parallel()

	t.Run("nil clock", func(t *testing.T) {
		t.Parallel()

		_, err := NewRandomHandler(nil, &recordingHTTPHandler{statusCode: http.StatusNoContent})
		if err == nil {
			t.Fatal("NewRandomHandler() error = nil, want an error for nil clock")
		}
	})

	t.Run("nil delegate", func(t *testing.T) {
		t.Parallel()

		_, err := NewRandomHandler(clock.RealClock{}, nil)
		if err == nil {
			t.Fatal("NewRandomHandler() error = nil, want an error for nil delegate")
		}
	})
}

func TestNewRandomHandlerRejectsNegativeClockTime(t *testing.T) {
	t.Parallel()

	fakeClock := clocktesting.NewFakeClock(time.Unix(-1, 0))
	_, err := NewRandomHandler(fakeClock, &recordingHTTPHandler{statusCode: http.StatusNoContent})
	if err == nil {
		t.Fatal("NewRandomHandler() error = nil, want integer-overflow error for negative timestamp")
	}
	if err.Error() != "integer overflow" {
		t.Errorf("NewRandomHandler() error = %q, want %q", err, "integer overflow")
	}
}

func TestRandomHandlerDelegatesCataloguePatternAndFormat(t *testing.T) {
	t.Parallel()

	delegate := &recordingHTTPHandler{
		statusCode:  http.StatusAccepted,
		contentType: "text/plain",
		body:        "delegated response",
	}
	handler, err := NewRandomHandler(clock.RealClock{}, delegate)
	if err != nil {
		t.Fatalf("NewRandomHandler() error = %v", err)
	}

	knownPatterns := make(map[string]struct{}, len(handler.tartans))
	for _, item := range handler.tartans {
		knownPatterns[item.Pattern] = struct{}{}
	}

	ctx := context.WithValue(context.Background(), randomHandlerContextKey{}, "preserved")
	request := httptest.NewRequest(http.MethodGet, "/?format=webp&pattern=not-the-catalogue-pattern&unused=value", nil)
	request = request.WithContext(ctx)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusAccepted {
		t.Fatalf("ServeHTTP() status = %d, want %d", response.Code, http.StatusAccepted)
	}
	if got := response.Header().Get("Content-Type"); got != "text/plain" {
		t.Errorf("Content-Type = %q, want %q", got, "text/plain")
	}
	if got := response.Body.String(); got != "delegated response" {
		t.Errorf("body = %q, want %q", got, "delegated response")
	}

	requests := delegate.snapshot()
	if len(requests) != 1 {
		t.Fatalf("delegate received %d requests, want 1", len(requests))
	}
	delegated := requests[0]
	if delegated.method != http.MethodGet {
		t.Errorf("delegated method = %q, want %q", delegated.method, http.MethodGet)
	}
	if _, ok := knownPatterns[delegated.query.Get("pattern")]; !ok {
		t.Errorf("delegated pattern %q is not in the embedded catalogue", delegated.query.Get("pattern"))
	}
	if got := delegated.query.Get("format"); got != "webp" {
		t.Errorf("delegated format = %q, want %q", got, "webp")
	}
	if got := delegated.query.Get("unused"); got != "" {
		t.Errorf("delegated query contains unrelated parameter unused=%q", got)
	}
	if got := delegated.contextValue; got != "preserved" {
		t.Errorf("delegated context value = %v, want %q", got, "preserved")
	}
}

func TestRandomHandlerOmitsUnspecifiedFormat(t *testing.T) {
	t.Parallel()

	delegate := &recordingHTTPHandler{statusCode: http.StatusNoContent}
	handler, err := NewRandomHandler(clock.RealClock{}, delegate)
	if err != nil {
		t.Fatalf("NewRandomHandler() error = %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("ServeHTTP() status = %d, want %d", response.Code, http.StatusNoContent)
	}
	requests := delegate.snapshot()
	if len(requests) != 1 {
		t.Fatalf("delegate received %d requests, want 1", len(requests))
	}
	if got := requests[0].query.Get("format"); got != "" {
		t.Errorf("delegated format = %q, want omitted", got)
	}
	if got := requests[0].query.Get("pattern"); got == "" {
		t.Error("delegated pattern is empty")
	}
}

func TestRandomHandlerRejectsNonGETMethod(t *testing.T) {
	t.Parallel()

	delegate := &recordingHTTPHandler{statusCode: http.StatusNoContent}
	handler, err := NewRandomHandler(clock.RealClock{}, delegate)
	if err != nil {
		t.Fatalf("NewRandomHandler() error = %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("ServeHTTP() status = %d, want %d", response.Code, http.StatusMethodNotAllowed)
	}
	if got := response.Header().Get("Allow"); got != http.MethodGet {
		t.Errorf("Allow = %q, want %q", got, http.MethodGet)
	}
	if got := len(delegate.snapshot()); got != 0 {
		t.Errorf("delegate received %d requests, want none", got)
	}
}

func TestRandomHandlerRejectsEmptyCatalogue(t *testing.T) {
	t.Parallel()

	delegate := &recordingHTTPHandler{statusCode: http.StatusNoContent}
	handler := &RandomHandler{
		tartans: nil,
		rng:     rand.New(rand.NewPCG(1, 2)),
		weave:   delegate,
	}

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("ServeHTTP() status = %d, want %d", response.Code, http.StatusServiceUnavailable)
	}
	if got := len(delegate.snapshot()); got != 0 {
		t.Errorf("delegate received %d requests, want none", got)
	}
}

func TestRandomHandlerConcurrentRequests(t *testing.T) {
	t.Parallel()

	const requestCount = 32
	delegate := &recordingHTTPHandler{statusCode: http.StatusNoContent}
	handler, err := NewRandomHandler(clock.RealClock{}, delegate)
	if err != nil {
		t.Fatalf("NewRandomHandler() error = %v", err)
	}

	var waitGroup sync.WaitGroup
	for range requestCount {
		waitGroup.Go(func() {
			request := httptest.NewRequest(http.MethodGet, "/?format=png", nil)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != http.StatusNoContent {
				t.Errorf("ServeHTTP() status = %d, want %d", response.Code, http.StatusNoContent)
			}
		})
	}
	waitGroup.Wait()

	if got := len(delegate.snapshot()); got != requestCount {
		t.Errorf("delegate received %d requests, want %d", got, requestCount)
	}
}

type randomHandlerContextKey struct{}

type recordedRequest struct {
	method       string
	query        url.Values
	contextValue any
}

type recordingHTTPHandler struct {
	mu          sync.Mutex
	requests    []recordedRequest
	statusCode  int
	contentType string
	body        string
}

func (h *recordingHTTPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	request := recordedRequest{
		method: r.Method,
		query:  r.URL.Query(),
	}
	request.contextValue = r.Context().Value(randomHandlerContextKey{})

	h.mu.Lock()
	h.requests = append(h.requests, request)
	h.mu.Unlock()

	if h.contentType != "" {
		w.Header().Set("Content-Type", h.contentType)
	}
	statusCode := h.statusCode
	if statusCode == 0 {
		statusCode = http.StatusOK
	}
	w.WriteHeader(statusCode)
	if h.body != "" {
		_, _ = w.Write([]byte(h.body))
	}
}

func (h *recordingHTTPHandler) snapshot() []recordedRequest {
	h.mu.Lock()
	defer h.mu.Unlock()

	requests := make([]recordedRequest, len(h.requests))
	copy(requests, h.requests)
	return requests
}
