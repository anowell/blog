package ai.howie.solarclock.provider

import android.Manifest
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import kotlin.math.abs

// Grants location (foreground, then "allow all the time") and shows what the
// provider currently knows. Opened from the launcher or by tapping the Solar
// offset complication.
class SetupActivity : ComponentActivity() {
    private lateinit var status: TextView
    private lateinit var action: Button

    private val foreground = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { refresh() }
    private val background = registerForActivityResult(ActivityResultContracts.RequestPermission()) { refresh() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (resources.displayMetrics.widthPixels * 0.15).toInt()
        status = TextView(this).apply { gravity = Gravity.CENTER; textSize = 13f }
        action = Button(this)
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(pad, pad, pad, pad)
            addView(status)
            addView(action)
        }
        setContentView(ScrollView(this).apply { addView(column) })
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun refresh() {
        when {
            !hasLocation(this) -> prompt("Solar time needs your longitude.", "Allow location") {
                foreground.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            }
            !hasBackgroundLocation(this) -> prompt("Allow location all the time so the face follows you.", "Allow all the time") {
                background.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            }
            else -> {
                startUpdates(this)
                status.text = describe()
                action.text = "Refresh"
                action.setOnClickListener { refresh() }
            }
        }
    }

    private fun prompt(message: String, label: String, onClick: () -> Unit) {
        status.text = message
        action.text = label
        action.setOnClickListener { onClick() }
    }

    private fun describe(): String {
        val anchor = Store(this).anchor() ?: return "Waiting for a first fix…"
        val now = System.currentTimeMillis()
        val tier = if (now >= anchor.staleAt()) TIER_STALE else tierFor(anchor.accuracyM)
        return listOf(
            "%s  (%.4f° %s)".format(offsetText(anchor.lon, tier), abs(anchor.lon), if (anchor.lon < 0) "W" else "E"),
            "±%.0f m, fixed %d min ago".format(anchor.accuracyM, (now - anchor.fixMs) / 60_000),
            "confirmed %d min ago".format((now - anchor.confirmedMs) / 60_000),
        ).joinToString("\n")
    }
}
