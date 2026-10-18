package server

import "time"

// Config provides all the parameters the server needs.
type Config struct {
	Address             string
	ImageCacheMaxBytes  uint64
	ImageCacheTTL       time.Duration
	WovenCacheMaxPixels uint64
	WovenCacheTTL       time.Duration

	ReadHeaderTimeout   time.Duration
	ReadTimeout         time.Duration
	WriteTimeout        time.Duration
	IdleTimeout         time.Duration
	ShutdownGracePeriod time.Duration

	WebPath      string
	WebIndexPath string
}
