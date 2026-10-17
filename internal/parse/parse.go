// Package parse parses a TDF string into something we can render.
package parse

import (
	"encoding/hex"
	"errors"
	"fmt"
	"image/color"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// errParse is used to indicate a problem during parsing.
var errParse = errors.New("Could not parse input")

// Parse
func Parse(pattern string) (*Sett, error) {
	colours, err := parseColours(pattern)
	if err != nil {
		return nil, err
	}
	warp, weft, err := parseThreads(pattern)
	if err != nil {
		return nil, err
	}
	sett, err := formSett(warp, weft, colours)
	if err != nil {
		return nil, err
	}
	return sett, nil
}

type colorRef byte

var colourRegex = regexp.MustCompile(`[a-z]#[a-fA-F0-9]{6}`)
var blockRegex = regexp.MustCompile(`[a-z][1-9][0-9]*`)
var lineRegex = regexp.MustCompile(`^(([a-z][1-9][0-9]*)+|([a-z][1-9][0-9]*)*\(([a-z][1-9][0-9]*)+\)([a-z][1-9][0-9]*)*)$`)

func parseColours(pattern string) (map[colorRef]color.Color, error) {
	defs := colourRegex.FindAllString(pattern, -1)
	if len(defs) == 0 {
		return nil, fmt.Errorf("%w: no colour definitions found", errParse)
	}

	colours := make(map[colorRef]color.Color)
	for _, found := range defs {
		parts := strings.Split(found, "#")
		if len(parts) != 2 {
			return nil, fmt.Errorf("%w: cannot parse as colour definition: %v", errParse, found)
		}
		ref := colorRef(parts[0][0])
		_, ok := colours[ref]
		if ok {
			return nil, fmt.Errorf("%w: duplicate colour code used: %v", errParse, ref)
		}
		hexCode, err := hex.DecodeString(parts[1])
		if err != nil {
			return nil, fmt.Errorf("%w: cannot parse has hex: %v", errParse, parts[1])
		}
		colours[ref] = color.RGBA{
			R: uint8(hexCode[0]),
			G: uint8(hexCode[1]),
			B: uint8(hexCode[2]),
			A: 255,
		}
	}
	return colours, nil
}

type parsedBlock struct {
	colour colorRef
	length int
}

func parseThreads(pattern string) ([]parsedBlock, []parsedBlock, error) {
	_, text, err := splitPattern(pattern)
	if err != nil {
		return nil, nil, err
	}

	threadTexts := strings.Split(text, "]")
	if len(threadTexts) > 2 {
		return nil, nil, fmt.Errorf(
			"%w: expected one or two thread sequences, got %d",
			errParse,
			len(threadTexts),
		)
	}

	parsedThreads := make([][]parsedBlock, len(threadTexts))
	for i, threadText := range threadTexts {
		if !lineRegex.MatchString(threadText) {
			return nil, nil, fmt.Errorf(
				"%w: invalid thread sequence: %q",
				errParse,
				threadText,
			)
		}

		thread, err := parseThread(threadText)
		if err != nil {
			return nil, nil, err
		}
		parsedThreads[i] = thread
	}

	if len(parsedThreads) == 1 {
		return parsedThreads[0], parsedThreads[0], nil
	}
	return parsedThreads[0], parsedThreads[1], nil
}

func splitPattern(pattern string) ([]string, string, error) {
	before, after, ok := strings.Cut(pattern, "[")
	if !ok {
		return nil, "", fmt.Errorf("%w: missing thread delimiter", errParse)
	}

	colourText := before
	definitions := colourRegex.FindAllString(colourText, -1)
	if len(definitions) == 0 {
		return nil, "", fmt.Errorf("%w: no colour definitions found", errParse)
	}

	if strings.Join(definitions, "") != colourText {
		return nil, "", fmt.Errorf(
			"%w: invalid text in colour definitions",
			errParse,
		)
	}

	threadText := after
	if threadText == "" {
		return nil, "", fmt.Errorf("%w: no thread definition found", errParse)
	}

	return definitions, threadText, nil
}

// A thread is made up of blocks. It may contain either a) just blocks, or
// b) some blocks, followed by some blocks between parentheses, followed by
// more blocks. In the latter case, this indicates that the blocks between
// parentheses should be reflected around the blocks that come after.
func parseThread(thread string) ([]parsedBlock, error) {
	start := strings.Index(thread, "(")
	end := strings.Index(thread, ")")
	if (start == -1) != (end == -1) {
		return nil, fmt.Errorf("%w: contains unmatched parentheses: %v", errParse, thread)
	}
	// No repeat block
	if start == -1 && end == -1 {
		blocks := blockRegex.FindAllString(thread, -1)
		parsed := make([]parsedBlock, len(blocks))
		for i, b := range blocks {
			length, err := strconv.Atoi(b[1:])
			if err != nil {
				return nil, fmt.Errorf("%w: cannot parse as int %v", errParse, b[1:])
			}
			block := parsedBlock{
				colour: colorRef(b[0]),
				length: length,
			}
			parsed[i] = block
		}
		return parsed, nil
	}
	// Have repeat block
	pre, err := parseThread(thread[:start])
	if err != nil {
		return nil, err
	}
	block, err := parseThread(thread[start+1 : end])
	if err != nil {
		return nil, err
	}
	post, err := parseThread(thread[end+1:])
	if err != nil {
		return nil, err
	}
	backwardBlock := slices.Clone(block)
	slices.Reverse(backwardBlock)

	return slices.Concat(pre, block, post, backwardBlock), nil
}

func formSett(warp, weft []parsedBlock, colours map[colorRef]color.Color) (*Sett, error) {
	sett := &Sett{
		Warp: Thread{Blocks: make([]Block, len(warp))},
		Weft: Thread{Blocks: make([]Block, len(weft))},
	}
	for i, b := range warp {
		resolved, err := resolveBlock(b, colours)
		if err != nil {
			return nil, err
		}
		sett.Warp.Blocks[i] = *resolved
	}
	for i, b := range weft {
		resolved, err := resolveBlock(b, colours)
		if err != nil {
			return nil, err
		}
		sett.Weft.Blocks[i] = *resolved
	}

	return sett, nil
}

func resolveBlock(block parsedBlock, colours map[colorRef]color.Color) (*Block, error) {
	colour, ok := colours[block.colour]
	if !ok {
		return nil, fmt.Errorf("%w: pattern references undefined colour %d", errParse, block.colour)
	}
	return &Block{
		Colour: colour,
		Length: block.length,
	}, nil
}
