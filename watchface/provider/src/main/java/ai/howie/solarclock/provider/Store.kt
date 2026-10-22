package ai.howie.solarclock.provider

import android.content.Context

// The current anchor, in SharedPreferences. Doubles are stored as raw long
// bits so no precision is lost.
class Store(ctx: Context) {
    private val prefs = ctx.getSharedPreferences("anchor", Context.MODE_PRIVATE)

    fun anchor(): Anchor? {
        if (!prefs.contains("fixMs")) return null
        return Anchor(
            lat = double("lat"),
            lon = double("lon"),
            accuracyM = prefs.getFloat("accuracyM", 0f),
            fixMs = prefs.getLong("fixMs", 0),
            confirmedMs = prefs.getLong("confirmedMs", 0),
        )
    }

    fun save(a: Anchor) {
        prefs.edit()
            .putLong("lat", a.lat.toRawBits())
            .putLong("lon", a.lon.toRawBits())
            .putFloat("accuracyM", a.accuracyM)
            .putLong("fixMs", a.fixMs)
            .putLong("confirmedMs", a.confirmedMs)
            .apply()
    }

    private fun double(key: String) = Double.fromBits(prefs.getLong(key, 0))
}
