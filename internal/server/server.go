// Package server orchestrates the running of everything.
package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"

	"sett.fyi/tartan/internal/api"
)

var errNilConfig = errors.New("received nil config")

// Run configures and starts the server.
func Run(ctx context.Context, cfg *Config) error {
	if cfg == nil {
		return errNilConfig
	}

	imageCache, err := api.NewImageCache(cfg.ImageCacheMaxBytes, cfg.ImageCacheTTL)
	if err != nil {
		return fmt.Errorf("creating image cache: %w", err)
	}
	wovenCache, err := api.NewWovenCache(cfg.WovenCacheMaxPixels, cfg.WovenCacheTTL)
	if err != nil {
		return fmt.Errorf("creating woven cache: %w", err)
	}

	mux := http.NewServeMux()
	weave := api.NewWeaveHandler(imageCache, wovenCache)
	mux.Handle("/weave", weave)

	return serve(ctx, cfg, mux)
}

// serve listens on cfg.Address and serves handler until ctx is cancelled, then
// waits (up to cfg.ShutdownGracePeriod) for in-flight requests to finish.
// It is separate from Run so tests can supply their own handler.
func serve(ctx context.Context, cfg *Config, handler http.Handler) error {
	server := http.Server{
		Handler:           handler,
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
	}
	listenConfig := net.ListenConfig{}
	listener, err := listenConfig.Listen(ctx, "tcp", cfg.Address)
	if err != nil {
		return fmt.Errorf("could not listen: %w", err)
	}

	// Run Serve() in the background so we can also wait on ctx.
	// Buffer of 1 so the goroutine can always send and exit, even if
	// nobody is receiving any more.
	serveErr := make(chan error, 1)
	go func() {
		serveErr <- server.Serve(listener)
	}()

	// Block until either server fails or we're told to shutdown.
	select {
	case err := <-serveErr:
		// Serve only returns non-nil errors, so reaching here means failure.
		return fmt.Errorf("error serving: %w", err)
	case <-ctx.Done():
	}

	// ctx was cancelled so we need a new context for shutdown.
	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), cfg.ShutdownGracePeriod)
	defer cancel()
	err = server.Shutdown(shutdownCtx)
	if err != nil {
		return fmt.Errorf("error shutting down: %w", err)
	}

	return nil
}
