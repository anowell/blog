package ai.howie.solarclock.provider

import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

// The fix the face anchors solar time to. `confirmedMs` is the last time any
// fix agreed with it, which is what keeps it from going stale.
data class Anchor(val lat: Double, val lon: Double, val accuracyM: Float, val fixMs: Long, val confirmedMs: Long)

/**
 * Picks the anchor after a new fix. A less accurate fix only replaces a more
 * accurate one when it contradicts it, i.e. the two can't both be right given
 * their error radii. Otherwise it just confirms the current anchor.
 *
 * Corrections are steps: the face never runs its hands fast or slow to catch
 * up, so the rate of the hands always means the rate of solar time.
 */
fun choose(current: Anchor?, next: Anchor): Anchor {
    if (current == null || next.accuracyM <= current.accuracyM) return next
    val apart = distanceM(current.lat, current.lon, next.lat, next.lon)
    return if (apart > current.accuracyM + next.accuracyM) next else current.copy(confirmedMs = next.fixMs)
}

// Precision tiers, sent to the face as RANGED_VALUE_MIN = -180 - tier. The face
// dims digits finer than the tier supports: the 5th digit of a day fraction is
// 10 µd ≈ 0.0036° of longitude (~270 m at mid latitudes), the 4th ~2.7 km.
const val TIER_PRECISE = 0
const val TIER_COARSE = 1
const val TIER_STALE = 2
const val PRECISE_M = 300f
const val COARSE_M = 3_000f

// An anchor nothing has confirmed for this long may no longer be where you are.
const val STALE_AFTER_MS = 30 * 60_000L

fun tierFor(accuracyM: Float) = when {
    accuracyM <= PRECISE_M -> TIER_PRECISE
    accuracyM <= COARSE_M -> TIER_COARSE
    else -> TIER_STALE
}

fun Anchor.staleAt() = confirmedMs + STALE_AFTER_MS

/** The anchor as a day offset from Greenwich (longitude / 360), to the digits its tier supports: "−.33986". */
fun offsetText(lon: Double, tier: Int): String {
    val digits = 5 - tier
    val scaled = floor(abs(lon) / 360.0 * 10.0.pow(digits)).toLong()
    return (if (lon < 0) "−" else "+") + "." + scaled.toString().padStart(digits, '0')
}

fun distanceM(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val p1 = Math.toRadians(lat1)
    val p2 = Math.toRadians(lat2)
    val dp = p2 - p1
    val dl = Math.toRadians(lon2 - lon1)
    val h = sin(dp / 2) * sin(dp / 2) + cos(p1) * cos(p2) * sin(dl / 2) * sin(dl / 2)
    return 2 * 6_371_000.0 * asin(sqrt(h))
}
