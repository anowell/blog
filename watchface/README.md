# Solar SI watch face

A Wear OS (Pixel Watch) face showing local mean solar time as SI fractions of a day, anchored to your current longitude. Companion to the "Terrestrial Spacetime" blog post. This directory moves to `../<name>` once the project has one; `_cobalt.yml` ignores it until then.

| Path | What |
| --- | --- |
| `gen/face.mjs` | Generates the face (`bun run face`). Edit this, not the XML. |
| `face/` | Watch Face Format v4 face: a code-free APK around `res/raw/watchface.xml`. |
| `provider/` | Kotlin companion app: reads location, publishes longitude as complication data. |
| `docs/wff-capabilities.md` | What WFF can and can't do, with sources. |

## Why two apps

Watch Face Format has no location data, and faces can't run code. So `provider/` reads location and publishes it as a `RANGED_VALUE` complication. The face binds it to a non-customizable slot and republishes the value with a `Reference` as `[REFERENCE.lon]` for the hands and digits. Until a fix arrives, the face uses the time zone's meridian.

## When longitude changes

The hands always run at the rate of solar time. A correction is a step, never a speed-up or slow-down, so the speed of a hand keeps one meaning. Most steps land while the screen is off: fixes arrive every few minutes, and the step for walking a few hundred meters is under a second.

What keeps steps rare is which fix the face is anchored to (`provider/.../Discipline.kt`):
- **A more accurate fix replaces the anchor.**
- **A less accurate fix only replaces it when it contradicts it**, i.e. the two are further apart than their error radii combined. A ±2 km fix inside a ±50 m anchor's circle just confirms the anchor.
- **Confirmation keeps an anchor fresh.** One nothing has confirmed for 30 minutes goes stale.

GPS jitter therefore never moves the hands. A step means you actually moved, by more than the anchor's accuracy.

## Showing accuracy

The SI reading dims the digits the fix can't support. The precision tier travels in the hidden slot's `RANGED_VALUE_MIN` (−180 minus the tier), which the face reads as `[REFERENCE.tier]`. With no provider, the tier defaults to 3 and the face falls back to the zone meridian.

| Tier | When | Dimmed | Last bright digit spans |
| --- | --- | --- | --- |
| 0 precise | anchor ≤ 300 m | none | 10 µd ≈ 0.9 s ≈ 270 m |
| 1 coarse | anchor ≤ 3 km | 5th | 100 µd ≈ 9 s ≈ 2.7 km |
| 2 stale | unconfirmed 30 min | 4th–5th | 1 md ≈ 86 s |
| 3 zone fallback | no provider or fix | 3rd–5th | 10 md ≈ 14 min |

The provider sends a two-entry timeline (the anchor's tier, then stale at `confirmedMs + 30 min`), so digits dim on time without the provider waking.

### Optional readouts

- **Solar offset** is a second complication from the provider. Put it in any slot: `−.33986` titled `122.35°W`, each to the digits the tier supports. Tapping it opens the setup screen.
- **Time zone** is a face setting (off by default). It shows `[TIMEZONE_ABB]` under civil time.

### Flights

On a plane, the watch usually has no usable fix: no window view for GPS, and in-flight Wi-Fi geolocates to a ground station. Two filters keep bad fixes out:
- fixes with accuracy worse than 5 km are rejected;
- so are fixes implying travel faster than 1300 km/h.

The face holds the departure longitude and marks it stale. The first good fix after landing is a big correction, so it steps. That happens at the same moment civil time jumps time zones, which is the honest behavior.

### Precision

One second of solar time is 1/240° of longitude, about 310 m at 47° N (463 m at the equator). The provider asks for fine location at *balanced* power. That's Wi-Fi/cell positioning, ~40–100 m, or ≈ 0.1–0.3 s, without waking GPS.

- **Coarse only:** if you grant only coarse location, fixes are ~2 km (±6 s) and still accepted.
- **Update cadence:** updates arrive every 1–5 min while moving (minimum 150 m of movement). Android throttles background location to a few updates an hour, and the provider also checks the fused provider's cached fix whenever the face asks.

## Preview without a watch

```sh
bun install                      # once: pins playwright-core to the cached Chromium
bun run preview                  # regenerates the face, writes preview/*.svg and *.png
bun run --cwd watchface preview  # same, from the blog root
```

`gen/preview.mjs` interprets the generated `watchface.xml`, the same file the watch reads. It evaluates the real expressions against mock data (time, longitude, complication values) and renders these scenarios: `face`, `ambient`, `zone`, `coarse`, `stale`, `no-provider` and `minimal`. PNGs need the pinned `playwright-core`; without it you get SVGs only.

**Faithful:**
- geometry, rotation and pivots;
- configuration branches, conditions and references;
- ambient variants;
- expression results. An unknown data source throws, so typos surface here.

**Approximate:**
- fonts. Google Sans Flex stands in for the device font (`SYNC_TO_DEVICE`);
- text baselines;
- complication icons, drawn as dashed placeholders.

## Build and install

Needs a JDK 17+ and the Android SDK. Installing Android Studio provides both. Neither is installed on this machine yet.

```sh
bun run face                      # regenerate face XML
./gradlew :face:assembleDebug :provider:assembleDebug

# Watch: Settings › Developer options › Wireless debugging, then:
adb pair <ip>:<pair-port>
adb connect <ip>:<port>
adb install provider/build/outputs/apk/debug/provider-debug.apk
adb install face/build/outputs/apk/debug/face-debug.apk
```

Open **Solar Longitude** on the watch, grant location, and choose "Allow all the time". Then select the **Solar SI** face. WFF runtime errors (bad expressions) show up in:

```sh
adb logcat --pid=$(adb shell pidof -s com.google.wear.watchface.runtime)
```

## Prototype checklist

Put the **Solar offset** complication in a slot, and open **Solar Longitude** for the anchor's longitude, accuracy and age. The face's SI reading should equal civil UTC time plus that offset.

1. **Reference crosses the slot boundary.** The SI reading matches UTC + offset, and no digits are dimmed with a precise fix. If the reading follows the zone meridian instead, move the whole dial inside a full-screen slot (`docs/wff-capabilities.md`).
2. **Fallback.** Uninstall the provider. The reading should follow the zone meridian with digits 3–5 dimmed. This depends on an unrendered `Reference` returning its `defaultValue`.
3. **Binding.** The face picks up the provider without choosing it in the editor, and without a permission prompt (or with one you can accept).
4. **Timelines.** Turn location off for 30 minutes. Digits 4–5 should dim at the stale time without the provider running. If WFF ignores timelines, push an update at the stale time instead.
5. **Precision.** The milliday hand steps once per mark (0.864 s) and the superscript digits tick evenly. Uneven jumps mean expressions lose precision.
6. **Number formatting.** Digits render as `5`, not `5.0`. The face uses `round(floor(...) % 10)`.

To test corrections without travelling, use the emulator's location controls (Extended controls › Location). Move a few hundred meters east with a precise fix, then send a coarse fix inside it (no step), then one outside it (step).

## Package names

`ai.howie.solarclock` (face) and `ai.howie.solarclock.provider` are placeholders until the project has a name. The face's `DefaultProviderPolicy` in `gen/face.mjs` references the provider's component name, so rename both together.
