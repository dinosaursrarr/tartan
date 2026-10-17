package parse_test

import (
	"image/color"
	"testing"

	"sett.fyi/tartan/internal/parse"
)

func TestParse(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		pattern string
		warp    []parse.Block
		weft    []parse.Block
		wantErr bool
	}{
		{
			name:    "single thread is used for warp and weft",
			pattern: "a#112233b#445566[a2b3",
			warp: []parse.Block{
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 2},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 3},
			},
			weft: []parse.Block{
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 2},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 3},
			},
		},
		{
			name:    "multi-digit counts",
			pattern: "a#FF0000b#00FF00[a12b3",
			warp: []parse.Block{
				{Colour: color.RGBA{R: 0xff, A: 0xff}, Length: 12},
				{Colour: color.RGBA{G: 0xff, A: 0xff}, Length: 3},
			},
			weft: []parse.Block{
				{Colour: color.RGBA{R: 0xff, A: 0xff}, Length: 12},
				{Colour: color.RGBA{G: 0xff, A: 0xff}, Length: 3},
			},
		},
		{
			name:    "reflected group",
			pattern: "a#112233b#445566[a1(b2a3)b4",
			warp: []parse.Block{
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 1},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 2},
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 3},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 4},
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 3},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 2},
			},
			weft: []parse.Block{
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 1},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 2},
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 3},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 4},
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 3},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 2},
			},
		},
		{
			name:    "separate warp and weft sequences use closing bracket",
			pattern: "a#112233b#445566[a2b3]b1a2",
			warp: []parse.Block{
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 2},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 3},
			},
			weft: []parse.Block{
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 1},
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 2},
			},
		},
		{
			name:    "separate warp and weft sequences with multi-digit counts",
			pattern: "a#FF0000b#00FF00[a12b3]b4a5",
			warp: []parse.Block{
				{Colour: color.RGBA{R: 0xff, A: 0xff}, Length: 12},
				{Colour: color.RGBA{G: 0xff, A: 0xff}, Length: 3},
			},
			weft: []parse.Block{
				{Colour: color.RGBA{G: 0xff, A: 0xff}, Length: 4},
				{Colour: color.RGBA{R: 0xff, A: 0xff}, Length: 5},
			},
		},
		{
			name:    "reflected group can begin the thread",
			pattern: "a#112233b#445566[(a2b3)",
			warp: []parse.Block{
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 2},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 3},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 3},
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 2},
			},
			weft: []parse.Block{
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 2},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 3},
				{Colour: color.RGBA{R: 0x44, G: 0x55, B: 0x66, A: 0xff}, Length: 3},
				{Colour: color.RGBA{R: 0x11, G: 0x22, B: 0x33, A: 0xff}, Length: 2},
			},
		},
		{name: "empty pattern", pattern: "", wantErr: true},
		{name: "no colour definitions", pattern: "a2b3", wantErr: true},
		{name: "no thread definitions", pattern: "a#112233[", wantErr: true},
		{name: "missing thread delimiter", pattern: "a#112233a2", wantErr: true},
		{name: "undefined colour reference", pattern: "a#112233[b2", wantErr: true},
		{name: "duplicate colour reference", pattern: "a#112233a#445566[a2", wantErr: true},
		{name: "invalid hexadecimal colour", pattern: "a#GG2233[a2", wantErr: true},
		{name: "whitespace inside a thread sequence is invalid", pattern: "a#112233[a1 a1", wantErr: true},
		{name: "whitespace before warp-weft separator is invalid", pattern: "a#112233[a1 ]b1", wantErr: true},
		{name: "whitespace after warp-weft separator is invalid", pattern: "a#112233[a1] b1", wantErr: true},
		{name: "leading whitespace is invalid", pattern: " a#112233[a2", wantErr: true},
		{name: "whitespace after delimiter is invalid", pattern: "a#112233[ a2", wantErr: true},
		{name: "trailing whitespace is invalid", pattern: "a#112233[a2 ", wantErr: true},
		{name: "zero thread count", pattern: "a#112233[a0", wantErr: true},
		{name: "thread count exceeds int range", pattern: "a#112233[a999999999999999999999999", wantErr: true},
		{name: "leading zero in thread count", pattern: "a#112233[a01", wantErr: true},
		{name: "more than two thread sequences", pattern: "a#112233[a1]b1]a1", wantErr: true},
		{name: "empty second thread sequence", pattern: "a#112233[a1]", wantErr: true},
		{name: "invalid trailing thread text", pattern: "a#112233[a2!", wantErr: true},
		{name: "unmatched opening parenthesis", pattern: "a#112233[a1(b2", wantErr: true},
		{name: "unmatched closing parenthesis", pattern: "a#112233[a1b2)", wantErr: true},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := parse.Parse(tt.pattern)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("Parse(%q) error = nil, want an error", tt.pattern)
				}
				return
			}
			if err != nil {
				t.Fatalf("Parse(%q) error = %v, want nil", tt.pattern, err)
			}
			if got == nil {
				t.Fatal("Parse returned a nil sett without an error")
			}
			assertBlocks(t, "warp", got.Warp.Blocks, tt.warp)
			assertBlocks(t, "weft", got.Weft.Blocks, tt.weft)
		})
	}
}

func TestSettPalette(t *testing.T) {
	t.Parallel()

	sett, err := parse.Parse("b#00FF00a#FF0000[a2b1")
	if err != nil {
		t.Fatalf("Parse() error = %v, want nil", err)
	}

	palette := sett.Palette()
	if len(palette) != 2 {
		t.Fatalf("Palette() length = %d, want 2", len(palette))
	}

	want := []color.Color{
		color.RGBA{G: 0xff, A: 0xff},
		color.RGBA{R: 0xff, A: 0xff},
	}
	for i, wantColour := range want {
		if !sameRGBA(palette[i], wantColour) {
			t.Errorf("Palette()[%d] = %#v, want %#v", i, palette[i], wantColour)
		}
	}
}

func TestThreadLengthAndIteratorThroughParsedSett(t *testing.T) {
	t.Parallel()

	sett, err := parse.Parse("a#112233b#445566[a2b3")
	if err != nil {
		t.Fatalf("Parse() error = %v, want nil", err)
	}
	if got, want := sett.Warp.Length(), 5; got != want {
		t.Fatalf("Warp.Length() = %d, want %d", got, want)
	}

	iter := sett.Warp.Iter()
	for index := 0; index < 5; index++ {
		_, ok := iter.Next()
		if !ok {
			t.Fatalf("Next() at index %d returned ok = false, want true", index)
		}
	}
	for index := 0; index < 2; index++ {
		_, ok := iter.Next()
		if ok {
			t.Fatalf("Next() after exhaustion, call %d returned ok = true, want false", index+1)
		}
	}
}

func assertBlocks(t *testing.T, direction string, got []parse.Block, want []parse.Block) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("%s block count = %d, want %d; got %#v", direction, len(got), len(want), got)
	}
	for i := range want {
		if got[i].Length != want[i].Length {
			t.Errorf("%s block %d length = %d, want %d", direction, i, got[i].Length, want[i].Length)
		}
		if !sameRGBA(got[i].Colour, want[i].Colour) {
			t.Errorf("%s block %d colour = %#v, want %#v", direction, i, got[i].Colour, want[i].Colour)
		}
	}
}

func sameRGBA(got, want color.Color) bool {
	gotR, gotG, gotB, gotA := got.RGBA()
	wantR, wantG, wantB, wantA := want.RGBA()
	return gotR == wantR && gotG == wantG && gotB == wantB && gotA == wantA
}
