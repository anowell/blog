---
layout: post.liquid

title: Calendar Puzzle
description:
published_date: 2022-12-01 20:00:00 -0800
data:
  cover_path: /images/covers/calendar-puzzle.jpg
  image_path: /images/calendar-puzzle/today-is-puzzle_thumb.jpg
---

While attending a [Seattle Universal Math Museum](https://seattlemathmuseum.org/) event with my kids at our local library, I was intrigued by this tetris-like calendar puzzle.

<img src="/images/calendar-puzzle/today-is-puzzle.jpg">

The premise is simple: place all the geometric shapes such that only a specific month and day remain uncovered. I sat with my daughter working translating, rotating, and reflecting geometric shapes to try and solve it for her birthday. While she persevered to solve it eventually, I gave up after a few minutes as my thoughts drifted to solving it with code.

This post is about explaining the engineering process to solve this (at a ComSci 101 level). If you just want the solution, see [this project on GitHub](https://github.com/anowell/today-puzzle).

## Ballparking complexity

To start, I made a few observations and did some quick back-of napkin math to understand the scope of the problem.

- The board is basically a 7x7 grid with a few square inaccessible
- There are 8 unique shapes
- A single orientation of any shape fits into about 20 unique positions on an empty board
- Some shapes have 8 unique orientations (4 rotates and their reflections)

Estimating 20 positions per 8 orientations on 8 pieces, I quickly had an approximate upper-bound of (20×8)<sup>8</sup> = 4.3E17 ways to attempt to brute force place all the pieces. That's 430 quadrillion! My intuition was that I needed to get this into the billions if I wanted to solve it quickly on my laptop.

I noticed some of the shapes have symmetries that cause certain rotations or reflections to be identical. The rectangle only has 2 unique orientations, and 3 other pieces only have 4 unique orientations. That cuts the possible placements in half 5 times, bringing us closer to 1 quadrillian placements.

But we can still do a lot better because each piece added has fewer valid locations. This is a harder to estimate, but if the first piece typically has 20×4 valid placements, the second piece probably averages closer to 17×4 valid placements, and then 14×4. If we start with the highly symmetrical pieces, we can ballpark starting with 20×2 placements for the rectangle, then 17×4 for the next piece, then 14×4, then 11×4, then 8×3, 5×3, 2×3, and just 1 for the final piece - that gets us closer to just 350 million placements. That's easily in the realm of something we can compute if the implementation is reasonably efficient.

I implemented this in Rust [because I know it well and like it](/posts/why-rust). But it also helps that Rust emphasizes explicit memory allocations, because accidentally allocating memory millions of times would make this much slower.

## The Board

My immediate reaction was to represent the board with an 8x8 [bitmap](https://en.wikipedia.org/wiki/Bitmap). Representing the board with a bitmaps allows using bitwise operations to efficiently calculate if pieces overlap. And while we only need a 7x7 grid, an 8x8 bitmap is easy to represent with a single 64-bit integer (`u64` in Rust).

A few months ago, I was tinkering with [a chess puzzle](https://github.com/anowell/chess-proof), and I used a chess library that represented the chessboard as a [`BitBoard`](https://docs.rs/chess/3.2.0/chess/struct.BitBoard.html). I simply used that `BitBoard` implementation with one key change: an empty chess board is represented by `BitBoard(0)` (all squares are zero) but an empty board for the Today-Is Puzzle looks like this:

```
Ja Fe Ma Ap Ma Ju XX XX
Ju Au Se Oc No De XX XX
01 02 03 04 05 06 07 XX
08 09 10 11 12 13 14 XX
15 16 17 18 19 20 21 XX
22 23 24 25 26 27 28 XX
29 30 31 XX XX XX XX XX
XX XX XX XX XX XX XX XX
```

We represent this using `BitBoard(0x0303_0101_0101_1FFF)` - with a hex value can be visualized in binary:

```
0 0 0 0 0 0 1 1    <- 0x03
0 0 0 0 0 0 1 1    <- 0x03
0 0 0 0 0 0 0 1    <- 0x01
0 0 0 0 0 0 0 1    <- 0x01
0 0 0 0 0 0 0 1    <- 0x01
0 0 0 0 0 0 0 1    <- 0x01
0 0 0 1 1 1 1 1    <- 0x1F
1 1 1 1 1 1 1 1    <- 0xFF
```

Each `0` is an empty square, and each `1` is a square where you cannot place anything.

## The Pieces

Chess pieces aren't going to work here since a chess piece only ever occupies one square. Each of our shapes fits in a 4x4 grid, so I created a smaller bitmap type (`BitPiece(u16)`) as the data structure for a piece. By convention, I decided I would enforce that every piece is always in the LSB (least significant bits) of the data structure (i.e. the bottom-right when visualized in a 4x4 grid), and then for each shape piece, I hard-coded one possible variation. I chose `0x0313` for the pink `C` or `U` shaped piece:

```
0 0 0 0    <- 0x0
0 0 1 1    <- 0x3
0 0 0 1    <- 0x1
0 0 1 1    <- 0x3
```

You can see all the pieces defined [here](https://github.com/anowell/today-puzzle/blob/c765a440de6d278e807c64bbfaf05cc1579c0f39/src/piece.rs#L3-L10).

There are a few critical bits of functionality needed for our pieces.

- [Rotate a piece](https://github.com/anowell/today-puzzle/blob/c765a440de6d278e807c64bbfaf05cc1579c0f39/src/piece.rs#L124-L142) - just rotate the 4x4 grid clockwise
- [Reflect a piece](https://github.com/anowell/today-puzzle/blob/c765a440de6d278e807c64bbfaf05cc1579c0f39/src/piece.rs#L84-L100) - just flip the 4x4 grid horizontally
- [Align a piece](https://github.com/anowell/today-puzzle/blob/c765a440de6d278e807c64bbfaf05cc1579c0f39/src/piece.rs#L144-L157) - after rotation or reflection, the bits may not be aligned to the LSB, so this is a helper to translate the piece to the LSB.
- [Create a `BitBoard` with a `BitPiece` at a specific coordinate](https://github.com/anowell/today-puzzle/blob/c765a440de6d278e807c64bbfaf05cc1579c0f39/src/piece.rs#L159-L168) - placing a piece's 4x4 grid onto an 8x8 grid

Now that the board is represented by one 8x8 bitmap and a piece placement is represented by another 8x8 bitmap, we can use bitwise operators to place pieces on the board:

- Bitwise AND to detect if the piece overlaps any `1` squares on the board ([happens here](https://github.com/anowell/today-puzzle/blob/c765a440de6d278e807c64bbfaf05cc1579c0f39/src/main.rs#L48))
- Bitwise OR to create a new board that combines the original board and the placed piece ([happens here](https://github.com/anowell/today-puzzle/blob/c765a440de6d278e807c64bbfaf05cc1579c0f39/src/main.rs#L53))

## The Algorithm

So to solve the puzzle, we simply need to:

1. Start with the empty board
2. Set the target month and date squares to `1`
3. Place all the pieces without overlapping any squares that already have a `1`

That last step is where we need an algorithm that will let us perfom every combination of legal piece placements. This is how we end up with millions of placements to evaluate. We use a [depth-first search technique](https://en.wikipedia.org/wiki/Depth-first_search).

1. Create an empty list of boards.
2. Then create a board for every possible valid placement of the first piece and add them to the list.
3. Then take the last board off the list. If that board has all 8 pieces placed, we found a solution. If not, create a board for every possible valid placement of the next piece on that board, and add those to the list.
4. Repeat step 3 until the list of boards is empty

Initially the list will grow very fast, but as the board has more pieces, there will be fewer legal placements.


## Wrapping Up

Every day of the year (including Feb 29) has [a solution](https://github.com/anowell/today-puzzle/blob/c765a440de6d278e807c64bbfaf05cc1579c0f39/first_solutions.txt), actually [multiple solutions](https://github.com/anowell/today-puzzle/blob/c765a440de6d278e807c64bbfaf05cc1579c0f39/count_solutions.txt):

- Oct 6 has the fewest unique solutions: 7
- Jan 20 has the most unique solutions: 195

The ballpark math was in the right order of magnitude: solving a single day requires evaluating approximately 450 million possible piece placements, though only about 1.5 million placements are valid.

The program is reasonably fast. On my laptop (Dell XPS 13 Plus):
  - it takes about 1 second to find all the solutions for a given date
  - it takes about 10 seconds to find one solution for every day of the year

And yet, it should be possible to make it faster (e.g. concurrency, maybe SIMD, perhaps a better algorithm). Fwiw, almost all the computation time is spent [converting 4x4 bitmaps into 8x8 bitmaps](https://github.com/anowell/today-puzzle/blob/c765a440de6d278e807c64bbfaf05cc1579c0f39/src/piece.rs#L159-L168).

I intend to cut my own version of this puzzle. And with this program, I could use it to experimentally determine:
- if other piece shapes could be used
- if other board layouts could be used

So I may end up with slight variations on this puzzle. But at this point, I've obsessed a bit too much over one puzzle.