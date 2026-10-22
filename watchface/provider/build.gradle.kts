// Companion app: reads location and publishes longitude as complication data
// for the face's hidden slot. AGP 9 compiles Kotlin without a separate plugin.
plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "ai.howie.solarclock.provider"
    compileSdk = 36

    defaultConfig {
        applicationId = "ai.howie.solarclock.provider"
        minSdk = 33
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }
}

dependencies {
    implementation(libs.activity)
    implementation(libs.complications.data.source)
    implementation(libs.coroutines.play.services)
    implementation(libs.play.services.location)
}
