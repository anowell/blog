---
layout: default.liquid

title: Deep Style Wall
description: How I created a photo wall of deep style art using a DeepFilter API.
published_date: 2016-12-19 20:00:00 -0800
data:
  cover_path: /images/covers/trail_walk-post_modern.jpg
  image_path: /images/deep-style-wall/painting_walk-post_modern_thumb.jpg
---

Nearly a year ago, my wife covered a wall in photos of our family. When she went to rotate the photos, I claimed the old collection for my office at home - a much needed improvement.

A few weeks ago, my colleagues at Algorithmia cranked out a pretty sweet [Deep Style Demo](http://demos.algorithmia.com/deep-style/) based on the [DeepFilter algorithm](https://algorithmia.com/algorithms/deeplearning/DeepFilter) (hat tip to [@BesirKurtulmus](https://twitter.com/BesirKurtulmus)). Immediately I hacked together a quick bash script to generate all 37 Deep Style variants of a single image. The full script is [here](https://gist.github.com/anowell/386035fede097e4aa505102481f00517), but at its core, it just loops through the filters and calls out to the `algo` CLI tool.

```bash
# Now loop through filters
for filter in $FILTERS; do
  echo "Rendering with $filter filter..."

  savePath="data://.my/temp/${FNAME%.*}-$filter.jpg"
  algo run $PROFILE_ARGS deeplearning/DeepFilter/0.5.7 \
    -d "{\"images\": [\"$IMAGE\"], \"savePaths\": [\"$savePath\"], \"filterName\": \"$filter\"}"
  algo cp $PROFILE_ARGS $savePath .
done
```

So while staring at my wall of photos one day, I felt I should take it a step further and have a wall of DeepFilter generated photos. A new project was born!

### Step 1: Curating

First I needed photos. Sadly our photos aren't particularly well-organized (I'm still holding out for the holy grail of photo storage solutions), so I had to scour through both my wife's and my Google Drive and One Drive accounts to gather a bunch of photos to use. I don't usually enjoy multi-hour long sessions of flipping through photo albums, so I hastily selected a wide variety images that I thought would be interesting. In the end, I had curated 111 photos for the next phase.

### Step 2: Generating DeepStyle Art

At 37 filters and 111 photos, using my previous script would generate 4,107 images. But I didn't really want to generate 37 variants of each image because, once again, skimming through another 4k photos isn't really my thing, but also because of the [Paradox of Choice](https://en.wikipedia.org/wiki/The_Paradox_of_Choice). Also, the previous script completely ignores the DeepFilter API support for batching multiple images into a single request so using it to generate 4,107 images would have cost near $30.

So I decided to rewind and write a new script that:

1. Randomly pick 4 filters for each image while still evenly distributing filters across all images
2. Batch multiple images into a single request (per-filter)

This was a little beyond the scope of a simple bash script (and too much of a one-off hack to justify writing in Rust), so I rekindled my love of ruby. A simple version of the random filter selection looks like this:

```ruby
PER_IMAGE = 4
filter_set = []
filter_paths = {}
all_paths.shuffle.each do |p|
  PER_IMAGE.times do
    filter_set = ALL_FILTERS.shuffle if filter_set.empty?
    f = filter_set.pop
    filter_paths[f] ||= []
    filter_paths[f] << p
  end
end
```

This creates a `Hash` that maps each filter to a set of image paths (random pairings) while ensuring that each filter is used approximately the same number of times overall. I added a quick snippet to pre-upload all my images to the Algorithmia Data API:

```ruby
data_dir = client.dir("data://.my/test")
all_paths.each do |p|
  basename = Pathname.new(p).basename
  data_file = data_dir.file(basename)
  data_dir.put_file(p)
end
```

And now I was ready to generate 444 images with just 37 API requests (12 images per request):

```ruby
filter_paths.each do |filter, paths|
  src_paths = paths.map do |p|
    basename = Pathname.new(p).basename
    data_dir.file(basename).data_uri
  end
  save_paths = paths.map do |p|
    "#{data_dir_uri}/#{generated_filename(p, filter)}"
  end
  data = {
    images: src_paths,
    savePaths: save_paths,
    filterName: filter,
  }

  puts "\n### Rendering #{src_paths.length} images with #{filter} filter..."
  algo = client.algo('deeplearning/DeepFilter/0.5.7')
  algo.set_timeout(300)
  resp = algo.pipe(data)
  resp.result['savePaths'].each { |p| puts p }
end
```

A half hour later and I have 444 generated images including several gems:

<div class="grid">
    <div class="col"><img src="/images/deep-style-wall/train_ride-colorful_dream_thumb.jpg"></div>
    <div class="col"><img src="/images/deep-style-wall/painting_walk-post_modern_thumb.jpg"></div>
    <div class="col"><img src="/images/deep-style-wall/buzz-crunch_paper_thumb.jpg"></div>
</div>

### Step 3: Rinse and Repeat

I quickly browsed the generated images, and selected my favorite of the 4 generated variants of each photo. For the cases where I didn't like any of the 4 choices, I took the original and set it aside for repeating the process. I selected about 70 generated images from the first batch, so I had about 40 images that I wanted to try on a few more filters. I bumped the `PER_IMAGE` number to 10, added more logic to avoid repeating image-filter pairings, and removed a few filters that never appealed to me. The next run of the script with 40 photos generated another 400 images. I manage to pick out another 25 photos, and then accepted the remaining images aren't well-suited to any of the filters*.

The full script used during this process is available [here](https://gist.github.com/anowell/fd8cd6706b6c16080f09e67765e6915d).

&ast; *I actually repeated this process one more time using all filters on the final 15 images, but I only kept 2 of the images from that batch, so it seems that subsequent iterations have diminishing returns.*

### Step 4: Print

I did a final round of curating the generated images and decided on 70 images for printing. A couple images earned 8x10 treatment, and I decided to experiment with printing 2 of the images on canvas. In the end, I spent about $2 in Algorithmia credits, $9 in prints at Sam's Club, and $30 for a pair of 8x10 framed canvas prints at a local print shop.

And now 23 filters are represented on my Deep Style Wall.

<img src="/images/deep-style-wall/photo-wall.jpg">
