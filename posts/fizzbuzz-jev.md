---
layout: post.liquid

title: FizzBuzz in Jev
description:
published_date: 2026-09-23 00:45:00 -0800

data:
  cover_path: /images/covers/fizzbuzz.jpg
  image_path: /images/fizzbuzz/fizzbuzz-og.jpg
  extra_css: /css/fizzbuzz.css
  transcript: true
  math: true
---

*Inspired by the classic [Fizz Buzz in Tensorflow](https://joelgrus.com/2016/05/23/fizz-buzz-in-tensorflow/).*

**Interviewer:** Let's implement fizzbuzz.

**Me:** Great. Let's spin up Claude.

**Interviewer:** For fizzbuzz?

**Me:** Of course. It's 2026, so like availability, I measure LOC written by agents in ["nines"](https://uptimeobserver.com/understanding-availability-comparing-nines-for-business-excellence/). I'm operating near 4 nines, so unless you're hoping for an implementation that exceeds 10k LOC, I won't be writing any of it.

Let's start with evals…

**Interviewer:** What exactly are you evaling?

**Me:** Well, for the sake of speed and trendiness, let's just pick Jev, but with more time we could generalize this across other models.

**Interviewer:** Perhaps we should just focus on code?

**Me:** Agreed.

```claude
Spin me up a rust binary to do evals for fizzbuzz…
```

**Interviewer:** Rust?

**Me:** Lean into the meme.

```claude
Read the Jev API docs. We'll wire up several fizzbuzz strategies using Jev.

As a baseline, let's use some random strategies: pure random & weighted random based on expected distribution of fizz/buzz/etc. And a naive strat that just picks the number.
```

**Interviewer:** Random strategies?

**Me:** Mostly vanity - to show that we're better than random. Honestly, we could get these numbers with [simple math](#simple-math), but it won't be our bottleneck, so let's not optimize prematurely.

```claude
For our eval data, use variants to represent it numerically, as words, and as a binary array.
```

**Interviewer:** Is the binary array necessary?

**Me:** I dunno yet. We'll know shortly.

```claude
Let's explore strategies to try:
- Minimal "Is this fizz/buzz/fizzbuzz?" questions
- Qualify that this is the FizzBuzz game in each question
- Add the divisibility rule to each question
- Just ask if the number is divisible by 3 or 5
```

**Interviewer:** Do we really need 4 strategies for fizzbuzz?

**Me:** We're at 7 if you count the baselines, but let's add a few more:

```claude
- Choice: what does FizzBuzz print for the number
- Given the classic interview problem description, what should be printed for the number
```

And of course, let's outsource the math as explicitly advised against:

```claude
- What is the remainder when divided by {3,5}?
```

And let's abuse scoring for a strategy?

```claude
- How fizzbuzzy is the number? (for some convoluted fizzy-scale)
```

**Interviewer:** Could we start implementing a solution?

**Me:** After we eval these strategies.

```claude
Write the eval function - standard fizzbuzz mod-branching.
```

**Interviewer:** Why don't you just write that function for me?

**Me:** We could spend 20 min talking about ownership and lifetimes, but honestly, Chris Morgan already wrote a great (albeit outdated) post years ago about [why your first FizzBuzz implementation might not work in Rust](https://chrismorgan.info/blog/rust-fizzbuzz/).

So let's stay focused and get this running.

```claude
Probe the API for a stable, unthrottled concurrency. Then run our evals for these strategies against each of our dataset variations over the dataset range 9000-10999.
```

**Interviewer:** 9000-10999?

**Me:** Too likely that 1-100 is in the training set. Also, instinctively, I want to vary the importance of the first digit. It's a range large enough to be interesting, and small enough to get quick answers.

And the results are rolling in...

{% include 'fizzjev-board.liquid' %}

**Interviewer:** So what did you conclude?

**Me:** I'm disappointed that model math won. You were right to doubt the binary array. But the fizziness scale is pretty epic!

**Interviewer:** We'll be in touch.

---

## Debrief

```jev
Based on the interview transcript, how does the interviewer vote on the candidate?
```

{% assign bars = site.data.fizzjev_verdict %}{% include 'bars.liquid' %}

Devastating. No more tokens for you, Jev.

You can find the [FizzJev slop grenade on GitHub](https://github.com/anowell/fizzjev).

<div class="modal" id="simple-math">
<a class="modal-backdrop" href="#!"></a>
<div class="modal-card">
<a class="modal-close" href="#!">×</a>

**Math**

Over any run of 15 numbers:

<div class="math">

$$P(\text{Fizz}) = P(3 \cap 5^c) = \tfrac{1}{3} \cdot \tfrac{4}{5} = \tfrac{4}{15} \approx 0.267$$
$$P(\text{Buzz}) = P(3^c \cap 5) = \tfrac{2}{3} \cdot \tfrac{1}{5} = \tfrac{2}{15} \approx 0.133$$
$$P(\text{FizzBuzz}) = P(3 \cap 5) = \tfrac{1}{3} \cdot \tfrac{1}{5} = \tfrac{1}{15} \approx 0.067$$
$$P(\text{number}) = P(3^c \cap 5^c) = \tfrac{2}{3} \cdot \tfrac{4}{5} = \tfrac{8}{15} \approx 0.533$$

</div>

A **random** draw gets us ¼ odds. A **random-weighted** draw using the true independent odds yields:

<div class="math">

$$P(\text{correct}) = P(\text{Fizz})^2 + P(\text{Buzz})^2 + P(\text{FizzBuzz})^2 + P(\text{number})^2$$
$$= \tfrac{17}{45} \approx 0.378$$

</div>

Sadly, still not better than an **always-number** draw at ≈ 0.533.

</div>
</div>
