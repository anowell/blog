---
layout: post.liquid

title: Calendar Puzzle
description:
published_date: 2022-12-01 20:00:00 -0800
data:
  cover_path: /images/covers/calendar-puzzle.jpg
  image_path: /images/calendar-puzzle/today-is-puzzle_thumb.jpg
  extra_css: /css/today-puzzle.css
---

While attending a [Seattle Universal Math Museum](https://seattlemathmuseum.org/) event with my kids at our local library, I was intrigued by this tetris-like calendar puzzle.

<img src="/images/calendar-puzzle/today-is-puzzle.jpg">

The premise is simple: place all the geometric shapes such that only a specific month and day remain uncovered. I sat with my daughter working translating, rotating, and reflecting geometric shapes to try and solve it for her birthday. While she persevered to solve it eventually, I gave up after a few minutes as my thoughts drifted to solving it with code.

This post is about explaining the engineering process to solve this (at a ComSci 101 level). [The full implementation is on GitHub](https://github.com/anowell/today-puzzle).

## Ballparking Complexity

Some games explode in computational complexity because of exponential math. While there are only 20 legal first moves in a game of chess, by the time you've made only 5 moves, there are trillions of possible games. In total, chess is estimated to have more than 10<sup>120</sup> possible games (see [Shannon Number](https://en.wikipedia.org/wiki/Shannon_number)) which is unimaginably large (for comparison, scientists estimate there are *just* 10<sup>80</sup> atoms in the universe). This makes it basically impossible to solve chess by brute force.

So before I started implementing a brute force solution to this puzzle, I wanted to get a ballpark understanding of the computational complexity. I made a few observations and did some quick back-of napkin math to understand the scope of the problem.

- The board is basically a 7x7 grid with a few unused squares
- There are 8 unique shapes
- A single orientation of any shape fits into *about* 20 unique positions on an empty board
- Some shapes have 8 unique orientations (4 rotations and their reflections)

Estimating 20 positions per 8 orientations on 8 pieces, I quickly had an approximate upper-bound of (20×8)<sup>8</sup> = 4.3×10<sup>17</sup> ways to attempt to brute force place all the pieces. That's 430 quadrillion! My intuition was that I needed to get this into the billions if I wanted to solve it quickly on my laptop (because a modern CPU can do billions of [instructions per second](https://en.wikipedia.org/wiki/Instructions_per_second)).

I noticed some of the shapes have symmetries that cause certain rotations or reflections to be identical. The rectangle only has 2 unique orientations, and 3 other pieces only have 4 unique orientations. That cuts the possible placements in half 5 times, bringing us closer to 1 quadrillian placements.

But we can still do a lot better because each piece added has fewer valid locations. This is a harder to estimate, but if the first piece typically has 20×8 valid placements, the second piece probably averages closer to 16×8 valid placements, and then 12×8, and so on. Taking into account the pieces symmetries, we can imagine starting with 20×2 placements for the rectangle, then 16×4 for the next piece, then 12×4, then 8×4, then 4×8, 2×8, 1×8, and just 1 for the final piece - that gets us closer to just 4 billion placements. This isn't a reliable proof of the upper bound, but it suggests we are working with an order of magnitude that seems *reasonable* to try and brute force if the implementation is efficient.

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

We represent this using `BitBoard(0x0303_0101_0101_1FFF)` - with a hex value that can be visualized in binary:

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

Chess pieces aren't going to work here since a chess piece only ever occupies one square. Each of our shapes fits in a 4x4 grid, so I created a smaller bitmap type (`BitPiece(u16)`) as the data structure for a piece. By convention, I decided I would enforce that every piece is always in the LSB (least significant bits) of the data structure (i.e. the bottom-right when visualized in a 4x4 grid). Then for each shape piece, I hard-coded one possible variation. I chose `0x0313` for the pink `C` or `U` shaped piece:

```
0 0 0 0    <- 0x0
0 0 1 1    <- 0x3
0 0 0 1    <- 0x1
0 0 1 1    <- 0x3
```

You can see all the pieces defined [here](https://github.com/anowell/today-puzzle/blob/c765a440de6d278e807c64bbfaf05cc1579c0f39/src/piece.rs#L3-L10).

There are a few critical bits of functionality needed for our pieces.

- [Rotate a piece](https://github.com/anowell/today-puzzle/blob/67c7e317ee480430495427e3a3e49f76f9be8d94/src/piece.rs#L132-L151) - just rotate the 4x4 grid clockwise
- [Reflect a piece](https://github.com/anowell/today-puzzle/blob/67c7e317ee480430495427e3a3e49f76f9be8d94/src/piece.rs#L112-L131) - just flip the 4x4 grid horizontally
- [Align a piece](https://github.com/anowell/today-puzzle/blob/67c7e317ee480430495427e3a3e49f76f9be8d94/src/piece.rs#L153-L187) - after rotation or reflection, the bits may not be aligned to the LSB, so this is a helper to translate the piece to the LSB.
- [Create a `BitBoard` with a `BitPiece` at a specific coordinate](https://github.com/anowell/today-puzzle/blob/67c7e317ee480430495427e3a3e49f76f9be8d94/src/piece.rs#L189-L199) - placing a piece's 4x4 grid onto an 8x8 grid

Now that the board is represented by one 8x8 bitmap and a piece placement is represented by another 8x8 bitmap, we can use bitwise operators to place pieces on the board:

- Bitwise AND to detect if the piece overlaps any `1` squares on the board ([happens here](https://github.com/anowell/today-puzzle/blob/67c7e317ee480430495427e3a3e49f76f9be8d94/src/main.rs#L44-L45))
- Bitwise OR to create a new board that combines the original board and the placed piece ([happens here](https://github.com/anowell/today-puzzle/blob/67c7e317ee480430495427e3a3e49f76f9be8d94/src/main.rs#L50))

## The Algorithm

So to solve the puzzle, we simply need to:

1. Start with the empty board
2. Set the target month and date squares to `1`
3. Place all the pieces without overlapping any squares that already have a `1`

That last step is where we need an algorithm that will let us perfom every combination of legal piece placements. This is how we end up with millions of placements to evaluate. We use a [depth-first search technique](https://en.wikipedia.org/wiki/Depth-first_search) ([implemented here](https://github.com/anowell/today-puzzle/blob/67c7e317ee480430495427e3a3e49f76f9be8d94/src/main.rs#L157-L189)).

1. Create an empty list of boards.
2. Then create a board for every possible valid placement of the first piece and add them to the list.
3. Then take the last board off the list. If that board has all 8 pieces placed, we found a solution. If not, create a board for every possible valid placement of the next piece on that board, and add those to the list.
4. Repeat step 3 until the list of boards is empty

Initially the list will grow very fast, but as the board has more pieces, there will be fewer legal placements.

## Visualizing Solutions

I wrapped this all up in a little program called `today-is` which visualizes each of the shapes with a different letter from `A-H`:

```shell
$ today-is
**** 12-01 ****
E E E E B B X X
E C C C B X X X
X D D C B B G X
A A D C H G G X
A A D D H H G X
A A F F H H G X
F F F X X X X X
X X X X X X X X

$ today-is --print count
12-01 has 26 solutions

$ today-is --date 12-25 --print count
12-25 has 92 solutions
```

Every day of the year has [multiple solutions](https://github.com/anowell/today-puzzle/blob/67c7e317ee480430495427e3a3e49f76f9be8d94/count_solutions.txt):

- Oct 6 has the fewest unique solutions: 7
- Jan 20 has the most unique solutions: 195

The ballpark math was an order of magnitude high: to solve a single day, this implementation evaluates approximately 450 million possible piece placements, though only about 1.5 million placements are valid.

The program is reasonably fast. On my laptop (Dell XPS 13 Plus):
  - it takes about 1 second to find all the solutions for a given date
  - it takes about 10 seconds to find [one solution for every day of the year](https://github.com/anowell/today-puzzle/blob/67c7e317ee480430495427e3a3e49f76f9be8d94/first_solutions.txt)
  - it takes about 6 minutes to find all solutions for all days of the year

And it should be possible to make it faster. There are 3 approaches that could make this faster:
- Concurrency - the current implementation only uses 1 CPU core.
- Computational optimizations - almost all the computation time is spent [converting 4x4 bitmaps into 8x8 bitmaps](https://github.com/anowell/today-puzzle/blob/67c7e317ee480430495427e3a3e49f76f9be8d94/src/piece.rs#L189-L199) which is what happens 450 million times. I suspect there may be some SIMD tricks to speed this up.
- Algorithmic improvements - there are likely improvements that would use less brute force and wouldn't have to evaluate 450 million possible placements. *I am certain my daughter didn't evaluate 450 million placements to find a solution!* Effectively, her brain (through intution and pattern recognition) created an *algorithm* (more like a neural network) that found a solution by only evaluating *hundreds* of possible placements.

But instead of making it faster, I decided I wanted an excuse to experiment with WebAssembly which Rust has great support for. So I wrapped it in a little Javascript and HTML to create an interactive solver:

<div class="grid">
    <div class="col">
      <div id="puzzle-container">
        <div id="puzzle-control">
          <input id="prev-day" type="button" value="<">
          <input id="date-picker" type="date">
          <input id="next-day" type="button" value=">">
        </div>
        <div id="puzzle"></div>
        <p><small>Note: This solver might not appear or work in older browsers.</small></p>
      </div>
    </div>
    <div class="col"><img src="/images/calendar-puzzle/today-is-puzzle.jpg"></div>
</div>

I intend to laser cut my own version of this puzzle, and even experiment with creating variations of the puzzle. For example, here is a more difficult variant with different shapes for purple and orange that is still solveable for every day of the year, but some of the days only have 1 solution.

<div style="text-align:center">
  <img src="/images/calendar-puzzle/today-is-hard-mode.png" style="width:280px;">
</div>

But for now, I've obsessed a bit too much over one puzzle.


<script type="module">
  import init, { solve_date, get_piece } from '/js/today_puzzle.js'

  function monthsForLocale(localeName = 'en-US', monthFormat = 'short') {
    const format = new Intl
      .DateTimeFormat(localeName, { month: monthFormat }).format
    return [...Array(12).keys()]
      .map((m) => format(new Date(Date.UTC(2021, (m + 1) % 12))))
  }
  const MONTHS = monthsForLocale()

  function getSquareText(n) {
    if (n % 8 == 7 || n == 6 || n == 14 || n > 50) { return '' }
    if (n < 6) { return MONTHS[n] }
    if (n >= 7 && n < 14) { return MONTHS[n - 2] }
    if (n < 24) { return n - 15 }
    if (n < 32) { return n - 16 }
    if (n < 40) { return n - 17 }
    if (n < 48) { return n - 18 }
    if (n <= 50) { return n - 19 }
    console.log("Unknown square: " + n)
  }

  function ymd(date) {
    const offset = date.getTimezoneOffset()
    date = new Date(date.getTime() - (offset * 60 * 1000))
    return date.toISOString().split('T')[0]
  }

  function clearViz() {
    updateViz(0n)
  }

  function makeBoard(solution) {
    let board = new Array(64)
    for (let i = 0; i < 8; i++) {
      let piece = get_piece(solution, i)
      for (let j = 0; j < 64; j++) {
        if ((piece & (1n << BigInt(j))) !== 0n) {
          board[j] = i
        }
      }
    }
    return board
  }

  function updateViz(board) {
    let table = '<table>'
    for (let i = 0; i < 7; i++) {
      table += '<tr>'
      for (let j = 0; j < 7; j++) {
        let text = getSquareText(i * 8 + j)
        let shape = 'unused'
        if(text != '') {
          shape = board[63 - (i * 8 + j)]
        }
        table = table + '<td class="shape-' + shape + '">' + text + '</td>'
      }
      table += '</tr>'
    }
    table += '</table>'
    document.getElementById("puzzle").innerHTML = table
  }

  function solve(date) {
    console.log('Solving for ' + date.toLocaleDateString())
    return makeBoard(solve_date(date.getMonth() + 1, date.getDate()))
  }

  async function run() {
    await init()

    let today = new Date()
    document.getElementById("date-picker").value = ymd(today)

    let solution = solve(today)
    updateViz(solution)
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById("date-picker").addEventListener("input", function () {
      clearViz()
      const offset = this.valueAsDate.getTimezoneOffset()
      let newDate = new Date(this.valueAsDate.getTime() + (offset * 60 * 1000))
      let solution = solve(newDate)
      updateViz(solution)
    });
    document.getElementById("prev-day").addEventListener("click", function () {
      let picker = document.getElementById("date-picker")
      clearViz()
      picker.stepDown()
      setTimeout(() => picker.dispatchEvent(new Event('input')))
    });
    document.getElementById("next-day").addEventListener("click", function () {
      let picker = document.getElementById("date-picker")
      clearViz()
      picker.stepUp()
      setTimeout(() => picker.dispatchEvent(new Event('input')))
    });
  }, false)

  run();
</script>