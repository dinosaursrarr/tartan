package api

import (
	"image"
	"time"

	"github.com/hashicorp/golang-lru/v2/expirable"
)

// ImageCache stores pre-computed rendered images in-memory for given requests.
type ImageCache = *expirable.LRU[imageCacheKey, imageCacheEntry]

// NewImageCache creates a new image cache with a given size and lifetime.
func NewImageCache(maxEntries int, ttl time.Duration) ImageCache {
	return expirable.NewLRU[imageCacheKey, imageCacheEntry](maxEntries, nil, ttl)
}

// WovenCache stores pre-computed but unrendered images in-memory for given requests.
type WovenCache = *expirable.LRU[string, wovenCacheEntry]

// NewWovenCache creates a new woven cache with a given size and lifetime.
func NewWovenCache(maxEntries int, ttl time.Duration) WovenCache {
	return expirable.NewLRU[string, wovenCacheEntry](maxEntries, nil, ttl)
}

type imageCacheKey struct {
	pattern string
	format  imageFormat
}

type imageCacheEntry struct {
	bytes       []byte
	contentType string
}

type wovenCacheEntry struct {
	img         image.Image
	colourCount int
}
