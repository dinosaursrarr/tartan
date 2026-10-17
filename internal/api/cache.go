package api

import (
	"time"

	"github.com/hashicorp/golang-lru/v2/expirable"
)

// Cache stores pre-computed results in-memory for given requests.
type Cache = *expirable.LRU[cacheKey, cacheEntry]

// NewCache creates a new cache with a given size and lifetime.
func NewCache(maxEntries int, ttl time.Duration) Cache {
	return expirable.NewLRU[cacheKey, cacheEntry](maxEntries, nil, ttl)
}

type cacheKey struct {
	pattern string
	format  imageFormat
}

type cacheEntry struct {
	bytes       []byte
	contentType string
}
