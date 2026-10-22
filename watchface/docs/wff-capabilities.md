# Watch Face Format: capabilities and the longitude problem

Research notes for a Pixel Watch face showing terrestrial (local mean solar) SI time.
Verified 2026-10-22 against:

- WFF XSD spec v1–v5 and the `dwf-validator` source in [google/watchface](https://github.com/google/watchface) at `d1cdafa` (2026-10-16). The validator's `VersionRegistry.kt` is the authoritative list of data sources and functions below.
- [WFF data sources](https://developer.android.com/training/wearables/wff/common/attributes/source-type), [arithmetic expressions](https://developer.android.com/training/wearables/wff/common/attributes/arithmetic-expression), [Complication](https://developer.android.com/reference/wear-os/wff/complication/complication), [DefaultProviderPolicy](https://developer.android.com/reference/wear-os/wff/complication/default-provider-policy), [exposing complication data](https://developer.android.com/training/wearables/complications/exposing-data).
- [android/wear-os-samples](https://github.com/android/wear-os-samples) `WatchFaceFormat/` (the Flavors sample uses a third-party `primaryProvider`).

## Verdict

WFF has **no location data source** in any version (v1–v5). Weather data has no coordinates either. But a GPS-anchored face is still possible without hand-picking a longitude:

1. A small Kotlin **complication data source** app (separate APK) reads coarse location and publishes longitude as a `RANGED_VALUE` (min −180, max 180).
2. The face declares a hidden, **non-customizable complication slot** (`isCustomizable="FALSE"`) whose `DefaultProviderPolicy` `primaryProvider` is that service (`package/ServiceClass`).
3. Inside that slot, a `Group` rotates by `[COMPLICATION.RANGED_VALUE_VALUE]` and publishes its angle with a **`Reference`** (WFF v4+). The rest of the face reads it anywhere as `[REFERENCE.lon]`.
4. If the provider is missing or has no fix, a `Complication type="EMPTY"` branch is shown. The face falls back to the zone meridian, `[TIMEZONE_OFFSET_MINUTES] / 4` degrees, and shows a subtle "≈".

If `Reference` can't carry values out of a complication at runtime, the fallback is to draw the whole SI dial *inside* a full-screen, non-customizable slot. `COMPLICATION.*` sources are documented as usable in expressions within the `Complication` element, and `Transform.value` is an expression.

### Day fraction without big numbers

Precision of WFF expression evaluation (float vs double) is undocumented. `UTC_TIMESTAMP` (~1.8×10¹² ms) would lose seconds in a 32-bit float, so build the fraction from small values:

```
solar = fract(([SECONDS_IN_DAY] + fract([SECOND_MILLISECOND])) / 86400
              - [TIMEZONE_OFFSET_MINUTES_DST] / 1440
              + [REFERENCE.lon] / 360 + 2)
```

`TIMEZONE_OFFSET_MINUTES_DST` (v3+) is the current local offset including DST. The `+ 2` keeps the argument positive. Deciday, centiday and milliday hands are `solar × 360`, `× 3600` and `× 360000` degrees (wrap with `% 360` if the renderer needs it).

### How fresh longitude can be

| Constraint | Source |
| --- | --- |
| `requestUpdate()` "not more often than every 5 minutes **on average**" (guidance, not documented as enforced) | exposing-data docs |
| `UPDATE_PERIOD_SECONDS` is 0 (push only) or ≥ 300 | exposing-data docs |
| Background apps get location updates only a few times per hour, unless they run a foreground service | Android 8+ background location limits |

The policy is: update only when |Δlon| > ~0.01° (≈ 2.4 s of solar time), throttled to ≥ 60 s. Also read the fused provider's cached `lastLocation` on every `onComplicationRequest`; that's free and often fresh, because other apps keep it warm.

Stationary, nothing updates and nothing needs to. Driving 100 km/h due east or west at 47° N moves solar time about 2.3 s per minute. With a 15-minute worst-case lag that's ≈ .000 9 d (< 1 md, about 80 s). Flying is the case that visibly lags. For ≤ 1 s accuracy (≈ 310 m at 47° N), ask for fine location at balanced power (~100 m from Wi-Fi/cell). Coarse (~2 km, ±6 s) still works if that's all the user grants. The README covers how corrections are stepped and when a fix replaces the anchor.

### Prototype risks (verify on device before building the real face)

1. Does `[REFERENCE.x]` published from inside a `Complication` resolve outside the slot? (Schema allows it; runtime unverified.)
2. Does an unrendered branch's `Reference` fall back to its `defaultValue` (needed for the GPS-or-fallback switch)?
3. Is `isCustomizable="FALSE"` + a third-party `primaryProvider` honored without the user picking it in the editor, and does a third-party provider need a user permission grant?
4. Expression float precision: does `SECOND_MILLISECOND`-level detail survive?
5. Ambient mode: expressions refresh about once per minute; the milliday hand and the superscript digits must hide.

## Inventory (v5, exhaustive per the validator)

### Data sources

**Time.** `UTC_TIMESTAMP`, `MILLISECOND`, `SECOND`, `SECOND_Z`, `SECOND_TENS_DIGIT`², `SECOND_UNITS_DIGIT`², `SECOND_MILLISECOND`, `SECONDS_IN_DAY`, `SECONDS_SINCE_EPOCH`³, `MINUTE`, `MINUTE_Z`, `MINUTE_TENS_DIGIT`², `MINUTE_UNITS_DIGIT`², `MINUTE_SECOND`, `MINUTES_SINCE_EPOCH`³, `HOUR_0_11`, `HOUR_0_11_Z`, `HOUR_0_11_MINUTE`, `HOUR_1_12`, `HOUR_1_12_Z`, `HOUR_1_12_MINUTE`, `HOUR_0_23`, `HOUR_0_23_Z`, `HOUR_0_23_MINUTE`, `HOUR_1_24`, `HOUR_1_24_Z`, `HOUR_1_24_MINUTE`, `HOUR_TENS_DIGIT`², `HOUR_UNITS_DIGIT`², `HOURS_SINCE_EPOCH`³, `AMPM_STATE`, `AMPM_POSITION`, `AMPM_STRING`, `IS_24_HOUR_MODE`

**Date.** `DAY`, `DAY_Z`, `DAY_HOUR`, `DAY_0_30`, `DAY_0_30_HOUR`, `DAY_OF_YEAR`, `DAY_OF_WEEK`, `DAY_OF_WEEK_F`, `DAY_OF_WEEK_S`, `FIRST_DAY_OF_WEEK`², `MONTH`, `MONTH_Z`, `MONTH_F`, `MONTH_S`, `DAYS_IN_MONTH`, `MONTH_DAY`, `MONTH_0_11`, `MONTH_0_11_DAY`, `YEAR`, `YEAR_S`, `YEAR_MONTH`, `YEAR_MONTH_DAY`, `WEEK_IN_MONTH`, `WEEK_IN_YEAR`

**Time zone.** `TIMEZONE`, `TIMEZONE_ABB`, `TIMEZONE_ID`, `TIMEZONE_OFFSET`, `TIMEZONE_OFFSET_DST`, `TIMEZONE_OFFSET_MINUTES`³ (standard), `TIMEZONE_OFFSET_MINUTES_DST`³ (current), `IS_DAYLIGHT_SAVING_TIME`

**Health.** `STEP_COUNT`, `STEP_GOAL`, `STEP_PERCENT`, `HEART_RATE`, `HEART_RATE_Z`

**Device.** `BATTERY_PERCENT`, `BATTERY_CHARGING_STATUS`, `BATTERY_IS_LOW`, `BATTERY_TEMPERATURE_CELSIUS`, `BATTERY_TEMPERATURE_FAHRENHEIT`, `UNREAD_NOTIFICATION_COUNT`, `LANGUAGE_LOCALE_NAME`, `ACCELEROMETER_IS_SUPPORTED`, `ACCELEROMETER_X/Y/Z`, `ACCELEROMETER_ANGLE_X/Y/Z`, `ACCELEROMETER_ANGLE_XY`

**Moon.** `MOON_PHASE_POSITION`, `MOON_PHASE_TYPE`, `MOON_PHASE_TYPE_STRING`

**Weather (v2).** `WEATHER.` + `IS_AVAILABLE`, `IS_ERROR`, `CONDITION`, `CONDITION_NAME`, `IS_DAY`, `TEMPERATURE`, `TEMPERATURE_UNIT`, `DAY_TEMPERATURE_LOW`, `DAY_TEMPERATURE_HIGH`, `CHANCE_OF_PRECIPITATION`, `UV_INDEX`, `LAST_UPDATED`. Hourly `WEATHER.HOURS.{n}.` + `IS_AVAILABLE`, `CONDITION`, `CONDITION_NAME`, `IS_DAY`, `TEMPERATURE`, `UV_INDEX`. Daily `WEATHER.DAYS.{n}.` + `IS_AVAILABLE`, `CONDITION_DAY(_NAME)`, `CONDITION_NIGHT(_NAME)`, `TEMPERATURE_LOW/HIGH`, `CHANCE_OF_PRECIPITATION(_NIGHT)`, `UV_INDEX`.

**Scoped.** `CONFIGURATION.<id>` (user settings), `REFERENCE.<name>` (v4), and `COMPLICATION.*` inside a `Complication` of the matching type:

| Type | Fields |
| --- | --- |
| SHORT_TEXT, LONG_TEXT | `TEXT`, `TITLE`, `MONOCHROMATIC_IMAGE(_AMBIENT)`; LONG_TEXT adds `SMALL_IMAGE` |
| RANGED_VALUE | `RANGED_VALUE_VALUE/MIN/MAX`, `RANGED_VALUE_COLORS`, `RANGED_VALUE_COLORS_INTERPOLATE`, `TEXT`, `TITLE`, images |
| GOAL_PROGRESS | `GOAL_PROGRESS_VALUE`, `GOAL_PROGRESS_TARGET_VALUE`, colors, `TEXT`, `TITLE`, images |
| WEIGHTED_ELEMENTS | `WEIGHTED_ELEMENTS_COLORS/WEIGHTS/BACKGROUND_COLOR`, `TEXT`, `TITLE`, images |
| SMALL_IMAGE, PHOTO_IMAGE, MONOCHROMATIC_IMAGE | image fields, `IMAGE_STYLE` |

Superscripts mark the version a source arrived in; unmarked sources are v1. No location, latitude, longitude, sunrise or sunset source exists. The `SUNRISE_SUNSET` *system complication provider* exists, but it only offers text/time, not coordinates.

### Functions and operators

`round`, `floor`, `ceil`, `fract`, `abs`, `clamp(v,min,max)`, `rand(a,b)`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `deg`, `rad`, `pow(a,b)`, `sqrt`, `cbrt`, `exp`, `expm1`, `log`, `log2`, `log10`, `numberFormat(fmt,v)`, `icuText(fmt[,ms])`, `icuBestText(fmt[,ms])` (2-arg forms v2), `subText(s,start,end)`, `textLength(s)`, `colorRgb`, `colorArgb`, `extractColorFromColors`, `extractColorFromWeightedColors` (color functions v4).

Operators: `+ - * / %` (float `%` works), comparisons, `== !=`, `&& || !`, bitwise `~ | &`, ternary `? :`. `x / 0` evaluates to 0. There is no `atan2`.

### Structure and transforms

- **Scene children:** `Group`, `Part*`, `AnalogClock` / `DigitalClock` (civil time only), `ComplicationSlot`, `Condition`, `ListConfiguration` / `BooleanConfiguration` branches.
- **Parts:** `PartDraw` (`Line`, `Arc`, `Ellipse`, `Rectangle`, `RoundRectangle`; `Stroke`, `WeightedStroke`, `Fill`, linear/radial/sweep gradients), `PartImage` (+ `HsbFilter`, `Photos`), `PartAnimatedImage`, `PartText` (`Text`, `TextCircular`, `Font`, `BitmapFont`; `Template`, `Upper`, `Lower`, `InlineImage`; shadow, outline, glow, underline, strikethrough decorations).
- **Transform:** `<Transform target="attr" value="expr" mode="TO|BY">`. Its target is any transformable attribute of the parent: geometry (`x`, `y`, `width`, `height`), `angle`, `pivotX/Y`, `alpha`, `scaleX/Y`, and colors. It can contain an optional `Animation`.
- **Gyro:** `x`, `y`, `scaleX/Y`, `angle`, `alpha` driven by accelerometer expressions.
- **Variant mode="AMBIENT":** per-attribute ambient values with transition timing (timing attributes v4).
- **Condition:** `Expressions` + `Compare expression=…` + `Default`.
- **Reference (v4):** `<Reference name source defaultValue>` on any `Group` or `Part`. It publishes that element's (transformed) attribute as `[REFERENCE.name]`. Circular references update only once.
- **Groups:** `blendMode` on Group and ComplicationSlot (v5), `renderMode`, `tintColor`.

### User configuration

`BooleanConfiguration`, `ListConfiguration` (options are element branches, not values; v5 adds nested settings and dynamic complications per option), `ColorConfiguration`, `PhotosConfiguration`, and `Flavors` (presets). There is no numeric or free-text input. That's why longitude has to come from a provider, not a setting.

### Other routes considered

- **Watch Face Push (Wear OS 6):** a marketplace app can install or update WFF faces. It could re-push a face with longitude baked in, but that means a full package update and validation token per change. Too heavy for location tracking.
- **Complication dynamic values (`androidx.wear.protolayout.expression`):** these are evaluated by the platform without the provider running. Platform sources cover time, health and events; I found no location source.
- **Legacy Jetpack/Kotlin watch face:** it would have direct location access, but it can no longer be installed from Play (since 2026-01-14), and it's a dead end even for sideloading.
