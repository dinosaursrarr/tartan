package weave

import "image/color"

// TwillWidth indicates the width of each woven twill unit.
const TwillWidth = 2

// TwillHeight indicates the height of each woven twill unit.
const TwillHeight = 2

type twill [TwillHeight][TwillWidth]color.Color
type twillFn func(h, v color.Color) twill

// Interleave threads with a simple twill where V is    VH
// the vertical thread and H is the horizontal thread.  HV.
func crossTwill(h, v color.Color) twill {
	return squareTwill(v, h, h, v)
}

// Interleave threads with a simple twill where V is    VH
// the vertical thread and H is the horizontal thread.  VH.
func verticalTwill(h, v color.Color) twill {
	return squareTwill(v, h, v, h)
}

// Interleave threads with a simple twill where V is    VV
// the vertical thread and H is the horizontal thread.  HH.
func horizontalTwill(h, v color.Color) twill {
	return squareTwill(v, v, h, h)
}

// Draw interleaved threads as a 2x2 square of pixels.
// Choice of twill is probably fairly meaningless if we scale to fit
// as the variations will get averaged out, but if we later pan over
// the full-sized image, then it would make a difference.
func squareTwill(topLeft, topRight, bottomLeft, bottomRight color.Color) twill {
	return twill{
		{topLeft, topRight},
		{bottomLeft, bottomRight},
	}
}
