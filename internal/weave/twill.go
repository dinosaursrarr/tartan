package weave

import "image/color"

// TwillWidth indicates the width of each woven twill unit.
const TwillWidth = 2

// TwillHeight indicates the height of each woven twill unit.
const TwillHeight = 2

// Twill represents a way of combining the warp and weft threads at a point in the fabric.
type Twill [TwillHeight][TwillWidth]color.Color
type twillFn func(h, v color.Color) Twill

// CrossTwill interleave threads with a simple twill where         VH
// V is the vertical thread and H is the horizontal thread.        HV.
func CrossTwill(h, v color.Color) Twill {
	return squareTwill(v, h, h, v)
}

// VerticalTwill interleave threads with a simple twill where      VH
// V is the vertical thread and H is the horizontal thread.        VH.
func VerticalTwill(h, v color.Color) Twill {
	return squareTwill(v, h, v, h)
}

// HorizontalTwill interleaves threads with a simple twill where   VV
// V is the vertical thread and H is the horizontal thread.        HH.
func HorizontalTwill(h, v color.Color) Twill {
	return squareTwill(v, v, h, h)
}

// Draw interleaved threads as a 2x2 square of pixels.
// Choice of twill is probably fairly meaningless if we scale to fit
// as the variations will get averaged out, but if we later pan over
// the full-sized image, then it would make a difference.
func squareTwill(topLeft, topRight, bottomLeft, bottomRight color.Color) Twill {
	return Twill{
		{topLeft, topRight},
		{bottomLeft, bottomRight},
	}
}
