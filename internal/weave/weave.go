// Package weave turns instructions into a rendered image.
package weave

import (
	"errors"
	"fmt"
	"image"

	"sett.fyi/tartan/internal/parse"
)

var errWeave = errors.New("problem during weaving")

// Tartan creates a rendered image from parsed instructions.
func Tartan(sett *parse.Sett, twill twillFn) (image.Image, error) {
	if sett == nil {
		return nil, fmt.Errorf("%w: input is nil", errWeave)
	}

	width := TwillWidth * sett.Warp.Length()
	height := TwillHeight * sett.Weft.Length()
	palette := sett.Palette()

	img := image.NewPaletted(image.Rect(0, 0, width, height), palette)
	weave(img, sett, twill)
	return img, nil
}

func weave(img *image.Paletted, sett *parse.Sett, twill twillFn) {
	weft := sett.Weft.Iter()
	r := 0
	for {
		v, weftOK := weft.Next()
		if !weftOK {
			break
		}
		warp := sett.Warp.Iter()
		c := 0
		for {
			h, warpOK := warp.Next()
			if !warpOK {
				break
			}
			cell := twill(h, v)
			for x := range TwillWidth {
				for y := range TwillHeight {
					img.Set(
						TwillWidth*c+x,
						TwillHeight*r+y,
						cell[y][x],
					)
				}
			}
			c++
		}
		r++
	}
}
