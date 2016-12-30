extends: default.liquid
base_url: http://anowell.com

title: Why Rust?
description: Qualifying my obsession with Rust.
date: 2016.12.29
cover_path: /images/covers/mario-warp.jpg
image_path: /images/why-rust/mario-whistle.jpg
---

*A response to Steve's [Rust is More than Safety](http://words.steveklabnik.com/rust-is-more-than-safety).*

I'll let you in on a secret: safety is not a *primary* motivation for my use of Rust. Its absence might deter me from the language, but it's presence doesn't persuade me to be an advocate. Also, while zero-overhead abstractions is very persuasive to me, in practice, I haven't built anything with Rust that actually demanded zero-overhead. So for me, Rust needs to be about more than "fast and safe."

And yet, I advocate enough for Rust that my team probably thinks I'm part of a cult. So why?

## Rust for fearless coding

Aaron wrote about [Fearless Concurrency in Rust](https://blog.rust-lang.org/2015/04/10/Fearless-Concurrency.html), and that's a great banner for Rust, but I want to back up and make the higher claim that Rust is for fearless coding and paint a picture of how that's valuable.

Fearless concurrency is largely achieved with the ownership and borrowing system and its clever use of `Send` and `Sync` traits. But there are several other language features that contribute to fearless coding. Lack of null means lack of null pointer exceptions. Exhaustive pattern matching decreases the liklihood of forgetting to handle a variant, even one added in the future. Immutable by default simplifies reasoning about state and decreases the likihood of unintended mutation. Explicit errror handling makes it harder to forget to handle some error case.

To pick on a popular type safe compiled language for a bit, I like Scala for its gains over Java, but I've forgotten to catch exceptions from Java libraries until they bubbled up to a global exception handler. I've hit null pointer exceptions. I've encountered data races. And to nitpick, more than once the compiler allowed me to write `a == b` not realizing the types didn't match and `true == Some(true)` evaluates to `false`. The cost to fix these bugs varies, often with how soon they are caught, but what they contribute to is a general notion that **the more lines of code I touch, the more bugs and regressions I'm introducing**. And Scala is actually quite solid on this front compared to many popular languages, yet Rust gives me significantly more confidence that when code compiles, it just works. Decreasing the concern of introducing regressions opens the door for **fearless refactoring** and as a consequence **iterative prototyping**.

A year ago, I wanted a lightweight service to be the common interface to running functions from several languages on our starup's platform - with the aim of standardizing the interface and believing that running a containerized instance of the JVM for every single running function was too heavy-weight. Admittedly, I prototyped it in Rust because I was looking for excuses to write more Rust, not because I believed Rust was well-suited for prototyping, so my argument is a post-hoc rationalization. I originally figured it would get rewritten in Go (in the name of a lower learning curve), but when the protoype had promising results, the choice was to clean up error handling for production (e.g. hunting down careless use of `.unwrap()` and refactor accordingly), or ramp up on Go and port it from scratch. Our team decided to ship some Rust. It is a fairly small service, just over 1k LOC, but after addressing 2 early bugs related to `unsafe` code dealing with linux pipes, it has "just worked". And if it works, don't touch it, right? Not quite. Six months later, I fearlessly refactored this production service so I could cleanly incorporate it into a test tool. **I just trust the compiler.**

*But isn't prototyping in Rust going to be slow?* Rapid prototyping is an art that requires a degree of language mastery. I could rapidly prototype in Ruby a lot sooner in my Ruby learning curve, but once the borrow checker drilled its concepts into my mind, prototyping in Rust became quite enjoyable. I could probably still prototype in Ruby about twice as fast, but I could probably iterate on a Rust protoype getting it into production in half the time, and the result would be more robust in the face of future maintenance and feature development. And I'm optimistic that mastering deeper corners of Rust (e.g. effective authoring of macro) will make prototyping with Rust even more productive. Speakin of productivity...

## Rust for productivity

I'm thrilled that [productivity is a central theme for Rust in 2017](https://internals.rust-lang.org/t/roadmap-2017-productivity-learning-curve-and-expressiveness/4097). The tagline **safe, fast, productive --- pick three** is my favorite catch phrase for Rust. While I applaud the critical eye toward the learning curve and paper cuts of the language, I already find Rust highly productive.

For example, I challenged a colleague to spin up a "hello world" project with SBT and Scala. He accepted, and 30 seconds later I posted this snippet:

![Zero-to-Hello-World in 30 seconds](/images/why-rust/zero-to-hello.png)

It's a simple example that is equally trivial in most scripting languages, but after a couple minutes tripping over SBT syntax and directory structure, he accepted that maybe zero-to-hello-world isn't Scala's strong suit. Fwiw, cloning [dph01/scala-sbt-template](https://github.com/dph01/scala-sbt-template) might be a reasonable solution here.

Interestingly, this challenge is pretty trivial for C/C++, but the real reason for the challenge was because I wanted to compare a particular edge case of JSON parsing between a few libraries. The basic idea was to spin up a throw-away project that measures JSON decoding. In Rust, [this was trivial](https://gist.github.com/anowell/349b787d47b16297cb55a302fd777faa). In Scala, I played in the SBT REPL for a while to get the numbers, but as a consequence, I no longer have the code for sharing. If I wanted to compare C/C++ libraries, the process of finding, adding, and building a couple JSON dependencies doesn't sound very productive. Rust achieves the productivity of Ruby, Python, and JavaScript for this sort of scenario.

The Rust ecosystem may be young, but it's full of great productivity wins. Crates.io rivals great package distribution solutions. The built-in testing and benchmarking frameworks are clean, simple, and effective. Tools like [rustfmt](https://github.com/rust-lang-nursery/rustfmt) ensure code consistency, [clippy](https://github.com/Manishearth/rust-clippy) catches a few boneheaded things that the compiler overlooks, [racer](https://github.com/phildawes/racer) has been a great start to code completion while waiting for [RLS](https://github.com/jonathandturner/rls), and rustdoc generates beautiful documentation. Wrap all of that up, and suddenly **Cargo is one of the most productivity-enhancing tools I've ever worked with**. Then there's rustup for managing rust versions and alternate toolchains, and the language itself has gems that promote productivity like iterators let you work at a near python-esque level, and the `?` operator lets you push errors around like a boss while macros like [quick-error](https://crates.io/crates/quick-error) and [error-chain](https://crates.io/crates/error-chain) trim down the boilerplate good error handling. The list goes on.

I still look forward to more expressiveness, more productivity around async I/O, better IDE support, better crate discoverability, and especially improvements to the learning curve that make Rust a bit easier to sell to my peers. So bring on 2017, but **make no mistake, I use Rust for productivity today**.

## Rust for crossing domains

<div class="float-right">
    <img title="Zero-to-Hello-World in 30 seconds" src="/images/why-rust/mario-whistle.jpg">
</div>

With all the talk of [Fire Flowers and Fire Mario](https://medium.com/@ag_dubs/fire-flowers-and-marios-marketing-rust-996b3fdbe8f3), I feel Rust is more like my [Magic Whistle](https://www.mariowiki.com/Warp_Whistle). It may sound less badass than a Fire Flower, but jumping between worlds is my modus operandi.

Five years ago, I concluded I wanted to transition from systems programming (devices) to web development. I starting seeing a world of devices increasingly deriving their value from the services that powered them, and I wanted to be on the service side of that. I still miss systems programming, but the more productive I got in web development ecosysystems, the less productive I felt in system domains, so the less I ventured into that space.

But it's more than just productivity. It's true that different tools are better suited for different tasks, but sometimes one tool is able to effectively decrease your need to reach for others. I don't expect Rust to be the best tool for all domains, but it turns out that **Rust can be quite effective across several domains** that interest me. Rust is undeniably capable in systems domains as evidenced by [servo](https://servo.org/), [redox](https://en.wikipedia.org/wiki/Redox), [ripgrep](http://blog.burntsushi.net/ripgrep/), etc. However, Rust is attracting varied degrees of interest in [web development](http://www.arewewebyet.org/), [gaming](http://arewegameyet.com/), [embedded](http://www.rust-embedded.org/), and [scientific and machine learning](http://www.arewelearningyet.com/) domains. As these ecosystems become more mature, I expect some of the most obvious "Why Not Rust?" arguments to fade.

In the past 2 years, I've used Rust to jump between several domains:

- I've shipped a [small web service](https://github.com/algorithmiaio/langpacks)
- I've built [cross-platform CLI tools](https://github.com/algorithmiaio/algorithmia-cli)
- I've experimented with a [networked FUSE filesystem](https://github.com/anowell/algorithmia-fuse) (and [framework](https://github.com/anowell/netfuse))
- I'm hacking on [a Rust-to-WASM framework](https://github.com/anowell/quasar) (hoping to blog about it soon)
- I'm tinkering with Rust on a Raspberry Pi (blog post coming soon).
- I've catalogued [the state of ML in Rust](http://arewelearningyet.com/), and hope dive a bit deeper into ML with Rust in 2017.

Before Rust, I'd have picked off a few of those with Ruby or JavaScript and not bothered with the rest while I cringed at scope of starting something from scratch in C. So **Rust is my Magic Whistle, and I use it to jump between worlds**. I'm just not using it to jump to Water Land (scripting) until I find a ridiculous looking Frog Suit.

