// Root build file. AGP 9 compiles Kotlin itself ("built-in Kotlin"); the classpath entry below only
// raises the Kotlin Gradle plugin from the version AGP bundles to the current stable one, which
// makes the build free of Gradle deprecation warnings. Do not apply org.jetbrains.kotlin.android.
buildscript {
    dependencies {
        classpath(libs.kotlin.gradle.plugin)
    }
}

plugins {
    alias(libs.plugins.android.application) apply false
}
