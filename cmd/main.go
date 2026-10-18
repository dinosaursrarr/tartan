// Package main is the entrypoint for running the service.
package main

import (
	"context"
	"flag"
	"log"
	"time"

	"sett.fyi/tartan/internal/server"
)

func main() {
	address := flag.String("address", "127.0.0.1:1746", "Address where the server should listen")
	readHeaderTimeout := flag.Duration("read_header_timeout", 3*time.Second, "Timeout for reading headers")
	readTimeout := flag.Duration("read_timeout", 30*time.Second, "Timeout for reading requests")
	writeTimeout := flag.Duration("write_timeout", 30*time.Second, "Timeout for writing responses")
	idleTimeout := flag.Duration("idle_timeout", 120*time.Second, "Timeout for idle connections")
	shutdownGracePeriod := flag.Duration("shutdown_grace_period", 30*time.Second, "Timeout for graceful shutdown")

	imageCacheMaxBytes := flag.Uint64(
		"image_cache_max_bytes",
		100*1024*1024,
		"Max size in bytes of in-memory cache of rendered images",
	)
	imageCacheTTL := flag.Duration("image_cache_ttl", time.Hour*24*365, "Max cached lifetime of rendered images")
	wovenCacheMaxPixels := flag.Uint64(
		"woven_cache_max_pixels",
		100*1024*1024,
		"Max size in pixels of unencoded images",
	)
	wovenCacheTTL := flag.Duration("woven_cache_ttl", time.Hour*24*365, "Max cached lifetime of unencoded images")

	webPath := flag.String("web_path", "internal/web/dist", "Path to the static website to be served")
	webIndexPath := flag.String("web_index_path", "index.html", "Path to the index file for the static website")

	flag.Parse()

	cfg := server.Config{
		Address:             *address,
		ReadHeaderTimeout:   nonZeroDuration(*readHeaderTimeout, "read_header_timeout"),
		ReadTimeout:         nonZeroDuration(*readTimeout, "read_timeout"),
		WriteTimeout:        nonZeroDuration(*writeTimeout, "write_timeout"),
		IdleTimeout:         nonZeroDuration(*idleTimeout, "idle_timeout"),
		ShutdownGracePeriod: nonZeroDuration(*shutdownGracePeriod, "shutdown_grace_period"),
		ImageCacheMaxBytes:  *imageCacheMaxBytes,
		ImageCacheTTL:       nonZeroDuration(*imageCacheTTL, "image_cache_ttl"),
		WovenCacheMaxPixels: *wovenCacheMaxPixels,
		WovenCacheTTL:       nonZeroDuration(*wovenCacheTTL, "woven_cache_ttl"),
		WebPath:             *webPath,
		WebIndexPath:        *webIndexPath,
	}
	err := server.Run(context.Background(), &cfg)
	if err != nil {
		log.Fatal(err.Error())
	}
}

func nonZeroDuration(t time.Duration, name string) time.Duration {
	if t <= 0 {
		log.Fatalf("%v must be a positive duration", name)
	}
	return t
}
