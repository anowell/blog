package ai.howie.solarclock.provider

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationText
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.NoDataComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.RangedValueComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationDataTimeline
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingTimelineComplicationDataSourceService
import androidx.wear.watchface.complications.datasource.TimeInterval
import androidx.wear.watchface.complications.datasource.TimelineEntry
import com.google.android.gms.location.LocationServices
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import java.time.Instant
import kotlin.math.abs

/**
 * Renders the stored anchor as complication data. The data is a two-step
 * timeline: the anchor's own tier until it goes stale, then stale, so the face
 * dims digits on time without this service waking up.
 */
abstract class AnchorDataSource : SuspendingTimelineComplicationDataSourceService() {
    abstract val type: ComplicationType

    abstract fun render(lon: Double, tier: Int): ComplicationData

    override fun onComplicationActivated(complicationInstanceId: Int, type: ComplicationType) {
        startUpdates(this)
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationDataTimeline? {
        if (request.complicationType != type) return null
        refreshFromCache()
        // No fix yet: report empty so the face falls back to the zone meridian.
        val anchor = Store(this).anchor() ?: return ComplicationDataTimeline(NoDataComplicationData(), emptyList())
        val now = System.currentTimeMillis()
        val stale = render(anchor.lon, TIER_STALE)
        if (now >= anchor.staleAt()) return ComplicationDataTimeline(stale, emptyList())
        val fresh = TimelineEntry(
            TimeInterval(Instant.ofEpochMilli(now), Instant.ofEpochMilli(anchor.staleAt())),
            render(anchor.lon, tierFor(anchor.accuracyM)),
        )
        return ComplicationDataTimeline(stale, listOf(fresh))
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        if (type == this.type) render(-122.35, TIER_PRECISE) else null

    // The fused provider's cached fix is free and often recent (the phone and
    // other apps keep it warm), so check it whenever a face asks. No update
    // push: this request is already the update.
    @SuppressLint("MissingPermission")
    private suspend fun refreshFromCache() {
        if (!hasLocation(this)) return
        val fix = withTimeoutOrNull(2_000) {
            LocationServices.getFusedLocationProviderClient(this@AnchorDataSource).lastLocation.await()
        } ?: return
        accept(this, fix, notify = false)
    }

    protected fun text(s: String): ComplicationText = PlainComplicationText.Builder(s).build()

    protected fun setupIntent(): PendingIntent =
        PendingIntent.getActivity(
            this, 0,
            Intent(this, SetupActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE,
        )
}

/**
 * Feeds the face's hidden slot. VALUE is longitude; MIN is -180 minus the
 * precision tier (a number the face can read); MAX stays 180.
 */
class LongitudeDataSource : AnchorDataSource() {
    override val type = ComplicationType.RANGED_VALUE

    override fun render(lon: Double, tier: Int): ComplicationData =
        RangedValueComplicationData.Builder(
            value = lon.toFloat(),
            min = -180f - tier,
            max = 180f,
            contentDescription = text("Longitude"),
        )
            .setTapAction(setupIntent())
            .build()
}

/**
 * An optional complication for any slot: the anchor as a day offset
 * ("−.33986") titled with its longitude ("122.35°W"), each to the digits the
 * fix supports.
 */
class OffsetDataSource : AnchorDataSource() {
    override val type = ComplicationType.SHORT_TEXT

    override fun render(lon: Double, tier: Int): ComplicationData {
        val degrees = "%.${2 - tier}f°%s".format(abs(lon), if (lon < 0) "W" else "E")
        return ShortTextComplicationData.Builder(text(offsetText(lon, tier)), text("Solar offset $degrees"))
            .setTitle(text(degrees))
            .setTapAction(setupIntent())
            .build()
    }
}
