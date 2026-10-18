package api

import (
	"fmt"
	"image"
	"time"

	"github.com/maypok86/otter/v2"
	"github.com/maypok86/otter/v2/stats"
)

// ImageCache stores pre-computed rendered images in-memory for given requests.
type ImageCache = *otter.Cache[imageCacheKey, imageCacheEntry]

// NewImageCache creates a new image cache with a given size and lifetime.
func NewImageCache(maxBytes uint64, ttl time.Duration) (ImageCache, error) {
	counter := stats.NewCounter()
	cache, err := otter.New(&otter.Options[imageCacheKey, imageCacheEntry]{
		MaximumWeight:    maxBytes,
		ExpiryCalculator: otter.ExpiryAccessing[imageCacheKey, imageCacheEntry](ttl),
		Weigher: func(_ imageCacheKey, e imageCacheEntry) uint32 {
			return bytesWeight(e.bytes)
		},
		StatsRecorder: counter,
	})
	if err != nil {
		return nil, fmt.Errorf("error creating image cache: %w", err)
	}
	return cache, nil
}

// WovenCache stores pre-computed but unrendered images in-memory for given requests.
type WovenCache = *otter.Cache[string, wovenCacheEntry]

// NewWovenCache creates a new woven cache with a given size and lifetime.
func NewWovenCache(maxPixels uint64, ttl time.Duration) (WovenCache, error) {
	counter := stats.NewCounter()
	cache, err := otter.New(&otter.Options[string, wovenCacheEntry]{
		MaximumWeight:    maxPixels,
		ExpiryCalculator: otter.ExpiryAccessing[string, wovenCacheEntry](ttl),
		Weigher: func(_ string, e wovenCacheEntry) uint32 {
			return pixelWeight(e.img)
		},
		StatsRecorder: counter,
	})
	if err != nil {
		return nil, fmt.Errorf("error creating woven cache: %w", err)
	}
	return cache, nil
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

func cacheWeight(value int64) uint32 {
	if value <= 0 {
		return 0
	}

	const maxUint32 = int64(1<<32 - 1)
	if value > maxUint32 {
		return ^uint32(0)
	}

	return uint32(value)
}

func bytesWeight(b []byte) uint32 {
	return cacheWeight(int64(len(b)))
}

func pixelWeight(img image.Image) uint32 {
	if img == nil {
		return 0
	}

	bounds := img.Bounds()
	width := int64(bounds.Dx())
	height := int64(bounds.Dy())

	if width <= 0 || height <= 0 {
		return 0
	}

	const maxUint32 = int64(1<<32 - 1)
	if width > maxUint32/height {
		return ^uint32(0)
	}

	return cacheWeight(width * height)
}
