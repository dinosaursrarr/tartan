package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"testing"
	"time"
)

// weavePath returns a request path (with a URL-encoded query) that the /weave
// handler accepts. Use it for every request sent to the real handler.
func weavePath() string {
	q := url.Values{"pattern": {"a#112233[a1"}}
	return "/weave?" + q.Encode()
}

// startServer runs run in the background and blocks until the server accepts
// connections. run should serve until its context is cancelled. The returned
// channel receives run's return value.
func startServer(
	t *testing.T,
	run func(ctx context.Context, cfg *Config) error,
) (string, context.CancelFunc, <-chan error) {
	t.Helper()

	addr, err := getFreePort()
	if err != nil {
		t.Fatalf("getting free port: %v", err)
	}
	cfg := &Config{
		Address:             addr,
		ImageCacheMaxBytes:  1 << 20,
		ImageCacheTTL:       time.Minute,
		WovenCacheMaxPixels: 1 << 20,
		WovenCacheTTL:       time.Minute,
		ReadHeaderTimeout:   5 * time.Second,
		ReadTimeout:         5 * time.Second,
		WriteTimeout:        5 * time.Second,
		IdleTimeout:         5 * time.Second,
		ShutdownGracePeriod: 5 * time.Second,
	}

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel) // safety net if the test fails early

	errCh := make(chan error, 1)
	go func() { errCh <- run(ctx, cfg) }()

	// run opens the socket asynchronously, so poll until it's accepting.
	dialer := net.Dialer{Timeout: 100 * time.Millisecond}
	deadline := time.Now().Add(2 * time.Second)
	for {
		conn, err := dialer.DialContext(t.Context(), "tcp", addr)
		if err == nil {
			_ = conn.Close()
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("server never started listening on %s: %v", addr, err)
		}
		time.Sleep(10 * time.Millisecond)
	}
	return addr, cancel, errCh
}

func waitForRun(t *testing.T, done <-chan error) error {
	t.Helper()
	select {
	case err := <-done:
		return err
	case <-time.After(3 * time.Second):
		t.Fatal("server did not return in time")
		return nil
	}
}

func TestRun_Serves(t *testing.T) {
	t.Parallel()
	addr, cancel, done := startServer(t, Run)

	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, "http://"+addr+weavePath(), nil)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	cancel()
	err = waitForRun(t, done)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
}

func TestRun_CleanShutdownReturnsNil(t *testing.T) {
	t.Parallel()
	_, cancel, done := startServer(t, Run)

	cancel()
	err := waitForRun(t, done)
	if err != nil {
		t.Fatalf("expected nil on clean shutdown, got: %v", err)
	}
}

// Shutdown must wait for a request that is being handled. We can't use a
// half-sent request for this: since Go 1.25 a connection that hasn't finished
// sending its request when Shutdown starts may be closed (golang/go#75591).
// Instead a handler we control blocks until the test releases it, so the
// request is genuinely in flight when shutdown begins.
func TestServe_ShutdownWaitsForInFlightRequest(t *testing.T) {
	t.Parallel()

	started := make(chan struct{})
	release := make(chan struct{})
	releaseOnce := sync.OnceFunc(func() { close(release) })
	t.Cleanup(releaseOnce) // don't leave the handler blocked if the test fails early

	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(started)
		<-release
		_, _ = w.Write([]byte("done"))
	})
	addr, cancel, done := startServer(t, func(ctx context.Context, cfg *Config) error {
		return serve(ctx, cfg, handler)
	})

	type result struct {
		status int
		err    error
	}
	resultCh := make(chan result, 1)
	go func() {
		req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, "http://"+addr+"/", nil)
		if err != nil {
			resultCh <- result{err: err}
			return
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			resultCh <- result{err: err}
			return
		}
		_ = resp.Body.Close()
		resultCh <- result{status: resp.StatusCode}
	}()

	// Wait until the handler is running, so the request really is in flight.
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("handler was never called")
	}

	cancel()

	// Shutdown has begun but the handler is still blocked: serve must keep waiting.
	select {
	case err := <-done:
		t.Fatalf("serve returned while a request was in flight (err=%v)", err)
	case <-time.After(200 * time.Millisecond):
	}

	releaseOnce()

	// The in-flight request must still get its response.
	select {
	case res := <-resultCh:
		if res.err != nil {
			t.Fatalf("in-flight request failed: %v", res.err)
		}
		if res.status != http.StatusOK {
			t.Fatalf("expected status 200, got %d", res.status)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("in-flight request never completed")
	}

	err := waitForRun(t, done)
	if err != nil {
		t.Fatalf("expected nil after draining, got: %v", err)
	}
}

var errFreePort = errors.New("unable to get a free port")

func getFreePort() (string, error) {
	listenConfig := net.ListenConfig{}
	listener, err := listenConfig.Listen(context.TODO(), "tcp", "127.0.0.1:0")
	if err != nil {
		return "", fmt.Errorf("%w: %w", errFreePort, err)
	}
	addr, ok := listener.Addr().(*net.TCPAddr)
	if !ok {
		return "", fmt.Errorf("%w: address was not a TCP address", errFreePort)
	}
	port := addr.Port
	err = listener.Close()
	if err != nil {
		return "", fmt.Errorf("%w: %w", errFreePort, err)
	}
	return fmt.Sprintf("127.0.0.1:%d", port), nil
}
