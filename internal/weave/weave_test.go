package weave

import (
	"image/color"
	"testing"

	"sett.fyi/tartan/internal/parse"
)

func TestWeaveTartan(t *testing.T) {
	t.Parallel()

	red := color.RGBA{R: 0xff, A: 0xff}
	green := color.RGBA{G: 0xff, A: 0xff}

	tests := []struct {
		name       string
		pattern    string
		twill      twillFn
		wantWidth  int
		wantHeight int
		wantPixels [][]color.Color
	}{
		{
			name:       "cross twill preserves diagonal orientation",
			pattern:    "a#FF0000b#00FF00[a1]b1",
			twill:      CrossTwill,
			wantWidth:  2,
			wantHeight: 2,
			wantPixels: [][]color.Color{
				{green, red},
				{red, green},
			},
		},
		{
			name:       "horizontal twill puts colours in horizontal bands",
			pattern:    "a#FF0000b#00FF00[a1]b1",
			twill:      HorizontalTwill,
			wantWidth:  2,
			wantHeight: 2,
			wantPixels: [][]color.Color{
				{green, green},
				{red, red},
			},
		},
		{
			name:       "vertical twill puts colours in vertical bands",
			pattern:    "a#FF0000b#00FF00[a1]b1",
			twill:      VerticalTwill,
			wantWidth:  2,
			wantHeight: 2,
			wantPixels: [][]color.Color{
				{green, red},
				{green, red},
			},
		},
		{
			name:       "multiple thread runs produce natural dimensions and expected cells",
			pattern:    "a#FF0000b#00FF00[a2b1]b1a2",
			twill:      CrossTwill,
			wantWidth:  6,
			wantHeight: 6,
			wantPixels: [][]color.Color{
				{green, red, green, red, green, green},
				{red, green, red, green, green, green},
				{red, red, red, red, red, green},
				{red, red, red, red, green, red},
				{red, red, red, red, red, green},
				{red, red, red, red, green, red},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			sett, err := parse.Parse(tt.pattern)
			if err != nil {
				t.Fatalf("Parse() error = %v, want nil", err)
			}

			got, err := Tartan(sett, tt.twill)
			if err != nil {
				t.Fatalf("WeaveTartan() error = %v, want nil", err)
			}
			if got == nil {
				t.Fatal("WeaveTartan() returned nil image without an error")
			}

			bounds := got.Bounds()
			if bounds.Dx() != tt.wantWidth || bounds.Dy() != tt.wantHeight {
				t.Fatalf("image bounds = %v, want dimensions %dx%d", bounds, tt.wantWidth, tt.wantHeight)
			}
			for y := range tt.wantPixels {
				for x := range tt.wantPixels[y] {
					assertColour(t, got.At(x, y), tt.wantPixels[y][x], x, y)
				}
			}
		})
	}
}

func TestWeaveTartanNilSett(t *testing.T) {
	t.Parallel()

	got, err := Tartan(nil, CrossTwill)
	if err == nil {
		t.Fatal("WeaveTartan(nil) error = nil, want an error")
	}
	if got != nil {
		t.Fatalf("WeaveTartan(nil) image = %v, want nil", got)
	}
}

func TestWeaveTartanSingleThreadUsesSameWarpAndWeft(t *testing.T) {
	t.Parallel()

	sett, err := parse.Parse("a#123456[a3")
	if err != nil {
		t.Fatalf("Parse() error = %v, want nil", err)
	}

	got, err := Tartan(sett, CrossTwill)
	if err != nil {
		t.Fatalf("WeaveTartan() error = %v, want nil", err)
	}
	wantWidth := TwillWidth * sett.Warp.Length()
	wantHeight := TwillHeight * sett.Weft.Length()
	if got.Bounds().Dx() != wantWidth || got.Bounds().Dy() != wantHeight {
		t.Fatalf("image dimensions = %dx%d, want %dx%d", got.Bounds().Dx(), got.Bounds().Dy(), wantWidth, wantHeight)
	}
	for y := range wantHeight {
		for x := range wantWidth {
			assertColour(t, got.At(x, y), color.RGBA{R: 0x12, G: 0x34, B: 0x56, A: 0xff}, x, y)
		}
	}
}

func assertColour(t *testing.T, got, want color.Color, x, y int) {
	t.Helper()

	gotR, gotG, gotB, gotA := got.RGBA()
	wantR, wantG, wantB, wantA := want.RGBA()
	if gotR != wantR || gotG != wantG || gotB != wantB || gotA != wantA {
		t.Errorf("pixel (%d,%d) = %#v (RGBA %04x,%04x,%04x,%04x), want %#v (RGBA %04x,%04x,%04x,%04x)",
			x, y, got, gotR, gotG, gotB, gotA, want, wantR, wantG, wantB, wantA)
	}
}
