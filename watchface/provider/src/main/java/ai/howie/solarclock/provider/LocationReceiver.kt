package ai.howie.solarclock.provider

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.LocationResult

// Receives batched location updates, and re-subscribes after a reboot or
// an app update (both drop PendingIntent-based location requests).
class LocationReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (intent.action) {
            ACTION_LOCATION -> LocationResult.extractResult(intent)?.locations?.forEach { accept(ctx, it) }
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> startUpdates(ctx)
        }
    }
}
