package ai.howie.solarclock.provider

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

// Fixes worse than this (IP geolocation on in-flight Wi-Fi, say) are ignored.
const val MAX_ACCURACY_M = 5_000f

// A fix implying faster travel than an airliner is treated as a glitch.
const val MAX_SPEED_MPS = 1_300 * 1000 / 3600.0

const val ACTION_LOCATION = "ai.howie.solarclock.provider.LOCATION"

fun hasLocation(ctx: Context) =
    ctx.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ctx.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

fun hasBackgroundLocation(ctx: Context) =
    ctx.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED

/**
 * Subscribes to passive-ish location updates delivered to [LocationReceiver].
 * Balanced power accuracy (Wi-Fi/cell, ~100 m) is well under the ~300 m that
 * one second of solar time spans at mid latitudes.
 */
@SuppressLint("MissingPermission")
fun startUpdates(ctx: Context) {
    if (!hasLocation(ctx)) return
    val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 5 * 60_000L)
        .setMinUpdateIntervalMillis(60_000L)
        .setMinUpdateDistanceMeters(150f)
        .build()
    LocationServices.getFusedLocationProviderClient(ctx).requestLocationUpdates(request, locationIntent(ctx))
}

private fun locationIntent(ctx: Context): PendingIntent =
    PendingIntent.getBroadcast(
        ctx, 0,
        Intent(ctx, LocationReceiver::class.java).setAction(ACTION_LOCATION),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
    )

// Data sources that render the anchor; all are refreshed when it changes.
private val SOURCES = listOf(LongitudeDataSource::class.java, OffsetDataSource::class.java)

// A confirmation alone only re-pushes once the face's timeline is this close
// to going stale, keeping pushes well under the ~5 minute average budget.
private const val REPUSH_BEFORE_STALE_MS = 10 * 60_000L

/** Folds a fix into the stored anchor; pushes complication updates when the face would change. */
fun accept(ctx: Context, fix: Location, notify: Boolean = true): Boolean {
    if (!fix.hasAccuracy() || fix.accuracy > MAX_ACCURACY_M) return false
    val store = Store(ctx)
    val current = store.anchor()
    if (current != null) {
        if (fix.time <= current.confirmedMs) return false
        val seconds = (fix.time - current.fixMs) / 1000.0
        val apart = distanceM(current.lat, current.lon, fix.latitude, fix.longitude)
        if (seconds > 0 && apart / seconds > MAX_SPEED_MPS) return false
    }
    val next = choose(current, Anchor(fix.latitude, fix.longitude, fix.accuracy, fix.time, fix.time))
    store.save(next)
    val moved = current == null || next.lon != current.lon || tierFor(next.accuracyM) != tierFor(current.accuracyM)
    val nearlyStale = current != null && current.staleAt() - fix.time < REPUSH_BEFORE_STALE_MS
    if (notify && (moved || nearlyStale)) {
        SOURCES.forEach { ComplicationDataSourceUpdateRequester.create(ctx, ComponentName(ctx, it)).requestUpdateAll() }
    }
    return true
}
