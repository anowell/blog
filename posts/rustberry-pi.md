---
layout: default.liquid

title: Rustberry Pi Basics
description: Getting started with Rust on a Raspberry Pi.
published_date: 2016-12-19 20:00:00 -0800
data:
  cover_path: /images/covers/trail_walk-post_modern.jpg
  image_path: /images/deep-style-wall/painting_walk-post_modern_thumb.jpg
is_draft: true
---

It's been nearly a decade since I've done any embedded system work, but I've been itching to tinker in that space again. I scored a Raspberry Pi 3b Christmas morning, and quickly thought up a first project, but first I needed to get back to the basics, with Rust of course:

I found several interesting "Rust on Raspberry Pi" guides, but most of them ended up being rabbit holes that took me on tangents. Rust is interesting for microcontroller programming, but I really just wanted to write some quick little apps for fun and guides suggesting to compile the rust compiler, and build kernel objects without a standard library for bare metal RPi development were not what I had in mind. I'm quite happy for my little tools to run on Raspbian instead of bare metal, so the process is actually much simpler.

However, my absence from embedded left me needing to overcome some basics that so many guides took for granted. The RPi basically maps to the `arm-unknown-linux-gnueabihf` target triple. Let's break that down:

- `arm` the CPU instruction set used by the RPi. It should be possible to use the `armv7` instruction set for recent versions of the Model B, but Raspbian is currently `arm` and `pi-tools` doesn't currently have `armv7` compiler utilities, so I'm sticking with `arm` in the interest of time.
- `unknown-linux` - the vendor and system to target, which effective means "generic linux". Constract this with `none` (e.g. arm-none-eab))


rustup target add arm-unknown-linux-gnueabihf
