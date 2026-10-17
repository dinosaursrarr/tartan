package parse

import (
	"cmp"
	"image/color"
	"maps"
	"slices"
)

// Sett represents weaving instructions for a repeatable unit of tartan.
type Sett struct {
	Warp Thread
	Weft Thread
}

// Palette returns the list of unique colours used in the tartan.
func (s *Sett) Palette() color.Palette {
	colours := map[color.Color]struct{}{}
	for _, b := range s.Warp.Blocks {
		colours[b.Colour] = struct{}{}
	}
	for _, b := range s.Weft.Blocks {
		colours[b.Colour] = struct{}{}
	}
	unique := maps.Keys(colours)
	sort := func(a, b color.Color) int {
		rA, gA, bA, _ := a.RGBA()
		rB, gB, bB, _ := b.RGBA()
		if rA != rB {
			return cmp.Compare(rA, rB)
		}
		if gA != gB {
			return cmp.Compare(gA, gB)
		}
		if bA != bB {
			return cmp.Compare(bA, bB)
		}
		return 0
	}
	palette := slices.Collect(unique)
	slices.SortFunc(palette, sort)
	return palette
}

// Thread represents everything to be woven in one direction.
type Thread struct {
	Blocks []Block
}

// Length returns the number of entries along the thread.
func (t *Thread) Length() int {
	n := 0
	for _, b := range t.Blocks {
		n += b.Length
	}
	return n
}

// Iter returns an iterator to iterate over a thread.
func (t *Thread) Iter() *ThreadIter {
	return &ThreadIter{
		thread: t,
		block:  0,
		count:  0,
	}
}

// ThreadIter is an iterator for iterating through a thread.
type ThreadIter struct {
	thread *Thread
	block  int
	count  int
}

// Next returns the current colour and whether it is valid.
func (i *ThreadIter) Next() (color.Color, bool) {
	if i.block >= len(i.thread.Blocks) {
		return nil, false
	}

	block := i.thread.Blocks[i.block]
	colour := block.Colour

	i.count++
	if i.count >= block.Length {
		i.block++
		i.count = 0
	}

	return colour, true
}

// Block represents a continuous run of one colour.
type Block struct {
	Colour color.Color
	Length int
}
