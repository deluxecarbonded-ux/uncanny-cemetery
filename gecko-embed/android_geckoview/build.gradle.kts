// settings.gradle.kts: add Mozilla's official Maven repository:
// dependencyResolutionManagement {
//     repositories {
//         google()
//         mavenCentral()
//         maven { url = uri("https://maven.mozilla.org/maven2/") }
//     }
// }

plugins {
    id("com.android.application")
    kotlin("android")
}

android {
    namespace = "com.example.geckoembed"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.geckoembed"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // Official Mozilla GeckoView engine (Gecko 159.0 release)
    implementation("org.mozilla.geckoview:geckoview:159.0.20261022150525")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
