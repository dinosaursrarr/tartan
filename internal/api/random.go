package api

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand/v2"
	"net/http"
	"net/url"
	"sync"

	clock "k8s.io/utils/clock"
)

// The list of tartans available to be drawn. Patterns are in Tartan Definition File (TDF) format,
// as described here: https://github.com/scruss/holestone-tartan/blob/master/mktartan.c, with
// the exception that I have collapsed line breaks. The patterns were lovingly borrowed from
// http://www.weddslist.com/cgi-bin/tartans/pg.pl, where you can see what they look like on
// a reasonably sized screen. Where the same pattern was recorded under multiple names, I picked
// one arbitrarily, as this isn't mean to be an authoritative source and I am no Lord Lyon.
//
//go:embed catalogue/tartans.json
var tartansRaw []byte

var errNilClock = errors.New("clock is nil")
var errNilHandler = errors.New("underlying handler is nil")
var errEmptyCatalogue = errors.New("empty catalogue")
var errOverflow = errors.New("integer overflow")

// RandomHandler serves patterns from our catalogue.
type RandomHandler struct {
	tartans []tartan
	rng     *rand.Rand
	rngMu   sync.Mutex
	weave   http.Handler
}

// NewRandomHandler returns a rendered image of a random tartan from our catalogue.
func NewRandomHandler(clock clock.Clock, weave http.Handler) (*RandomHandler, error) {
	var tartans []tartan
	err := json.Unmarshal(tartansRaw, &tartans)
	if err != nil {
		return nil, fmt.Errorf("reading tartan file: %w", err)
	}
	if len(tartans) == 0 {
		return nil, errEmptyCatalogue
	}

	if clock == nil {
		return nil, errNilClock
	}
	if weave == nil {
		return nil, errNilHandler
	}

	seed := clock.Now().UnixNano()
	if seed < 0 {
		return nil, errOverflow
	}
	rng := rand.New(rand.NewPCG(uint64(seed), 0))

	return &RandomHandler{
		tartans: tartans,
		weave:   weave,
		rng:     rng,
	}, nil
}

// ServeHTTP serves random patterns.
func (h *RandomHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		log.Printf("bad request: had method %v", r.Method)
		w.Header().Set("Allow", "GET")
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	if h.weave == nil {
		log.Printf("no underlying handler configured")
		http.Error(w, "no underlying handler configured", http.StatusServiceUnavailable)
		return
	}
	if len(h.tartans) == 0 {
		log.Print(errEmptyCatalogue.Error())
		http.Error(w, errEmptyCatalogue.Error(), http.StatusServiceUnavailable)
		return
	}

	h.rngMu.Lock()
	idx := h.rng.IntN(len(h.tartans))
	h.rngMu.Unlock()
	tartan := h.tartans[idx]

	q := make(url.Values)
	q.Add("pattern", tartan.Pattern)
	format := r.URL.Query().Get("format")
	if format != "" {
		q.Add("format", format)
	}
	url := new(url.URL)
	url.RawQuery = q.Encode()

	patternReq, err := http.NewRequestWithContext(r.Context(), http.MethodGet, url.String(), nil)
	if err != nil {
		log.Printf("unable to form underlying request: %v", err)
		http.Error(w, "unable to form underlying request", http.StatusInternalServerError)
		return
	}

	w.Header().Add("Cache-Control", "public, max-age=5")
	h.weave.ServeHTTP(w, patternReq)
}

type tartan struct {
	Name    string `json:"name"`
	Pattern string `json:"pattern"`
}
