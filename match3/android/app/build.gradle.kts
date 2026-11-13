import com.android.build.api.variant.BuildConfigField
import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    // AGP 9 has built-in Kotlin: no org.jetbrains.kotlin.android plugin.
    alias(libs.plugins.android.application)
}

// ───────────────────────── configurable values ─────────────────────────

/** android/admob.properties: the AdMob ids of the "ads" flavour (optional; they are not secrets). */
val adMobFile = Properties().apply {
    val file = rootProject.file("admob.properties")
    if (file.isFile) file.inputStream().use { load(it) }
}

/**
 * Command line (-PNAME=…) wins, then the environment variable NAME, then android/admob.properties,
 * then gradle.properties. Blank values count as "not set".
 */
fun optionalSetting(name: String): String? {
    val fromCommandLine = gradle.startParameter.projectProperties[name]
    val fromEnvironment = providers.environmentVariable(name).orNull
    return listOf(fromCommandLine, fromEnvironment, adMobFile.getProperty(name), providers.gradleProperty(name).orNull)
        .firstOrNull { !it.isNullOrBlank() }
        ?.trim()
}

fun setting(name: String): String =
    optionalSetting(name) ?: throw GradleException("Missing build setting $name (see android/gradle.properties)")

val appId = setting("APP_ID")
val appVersionCode = setting("VERSION_CODE").toIntOrNull()?.takeIf { it in 1..2_100_000_000 }
    ?: throw GradleException("VERSION_CODE must be a whole number between 1 and 2100000000")
val appVersionName = setting("VERSION_NAME")
val appTargetSdk = setting("TARGET_SDK").toIntOrNull()
    ?: throw GradleException("TARGET_SDK must be a whole number")

// ───────────────────────── release signing ─────────────────────────
// Upload key: android/keystore.properties (git-ignored) or ZUMURUD_* environment variables.
// Neither one → the release build still assembles, signed with the debug key, NOT FOR GOOGLE PLAY.

class UploadKey(val storeFile: File, val storePassword: String, val keyAlias: String, val keyPassword: String)

fun findUploadKey(): UploadKey? {
    val propsFile = rootProject.file("keystore.properties")
    val props = Properties()
    if (propsFile.isFile) propsFile.inputStream().use { props.load(it) }
    fun value(propName: String, envName: String): String? =
        (props.getProperty(propName) ?: providers.environmentVariable(envName).orNull)?.trim()?.takeIf { it.isNotEmpty() }

    val store = value("storeFile", "ZUMURUD_KEYSTORE") ?: return null
    val storePassword = value("storePassword", "ZUMURUD_KEYSTORE_PASSWORD")
    val alias = value("keyAlias", "ZUMURUD_KEY_ALIAS")
    val keyPassword = value("keyPassword", "ZUMURUD_KEY_PASSWORD") ?: storePassword
    if (storePassword == null || alias == null || keyPassword == null) {
        throw GradleException(
            "Release signing is half configured: a keystore is set but its password or key alias is missing " +
                "(keystore.properties: storeFile, storePassword, keyAlias, keyPassword — " +
                "or ZUMURUD_KEYSTORE, ZUMURUD_KEYSTORE_PASSWORD, ZUMURUD_KEY_ALIAS, ZUMURUD_KEY_PASSWORD).",
        )
    }
    val storeFile = rootProject.file(store)
    if (!storeFile.isFile) throw GradleException("Release keystore not found: $storeFile")
    return UploadKey(storeFile, storePassword, alias, keyPassword)
}

val uploadKey = findUploadKey()

// ───────────────────────── AdMob ids ("ads" flavour) ─────────────────────────
// ADMOB_APP_ID, ADMOB_REWARDED_ID, ADMOB_INTERSTITIAL_ID: -P, environment, android/admob.properties
// or gradle.properties.
//   - RELEASE builds use them. None of them set (or -PuseSampleAdIds=true) → Google's public
//     SAMPLE ids, which only ever show test ads; such a release is refused unless
//     -PallowTestAds=true says it is a test build that will never be uploaded.
//   - DEBUG builds always use the sample ids, whatever is configured: real ads must never be
//     requested while developing (the owner's rule in admob.properties, and AdMob's own).

class AdMobIds(val appId: String, val rewardedId: String, val interstitialId: String, val test: Boolean, val problem: String?)

/** Google's documented sample ids (developers.google.com/admob/android/test-ads): test ads only. */
val sampleAdMobIds = AdMobIds(
    appId = "ca-app-pub-3940256099942544~3347511713",
    rewardedId = "ca-app-pub-3940256099942544/5224354917",
    interstitialId = "ca-app-pub-3940256099942544/1033173712",
    test = true,
    problem = null,
)

fun findAdMobIds(): AdMobIds {
    // -PuseSampleAdIds=true: a release build for the test bench, with test ads although real ids exist.
    if (optionalSetting("useSampleAdIds").equals("true", ignoreCase = true)) return sampleAdMobIds
    val names = listOf("ADMOB_APP_ID", "ADMOB_REWARDED_ID", "ADMOB_INTERSTITIAL_ID")
    val values = names.map { optionalSetting(it) }
    if (values.all { it == null }) return sampleAdMobIds
    fun broken(problem: String) = AdMobIds(sampleAdMobIds.appId, sampleAdMobIds.rewardedId, sampleAdMobIds.interstitialId, true, problem)
    val missing = names.filterIndexed { index, _ -> values[index] == null }
    if (missing.isNotEmpty()) {
        return broken("The AdMob ids are half configured: ${missing.joinToString()} ${if (missing.size == 1) "is" else "are"} missing. Set all three of ${names.joinToString()} or none.")
    }
    val (app, rewarded, interstitial) = values.map { it!! }
    if (!Regex("ca-app-pub-\\d{16}~\\d{10}").matches(app)) {
        return broken("ADMOB_APP_ID does not look like an AdMob app id (ca-app-pub-0000000000000000~0000000000): the app id has a '~', ad unit ids have a '/'.")
    }
    for ((name, unit) in listOf("ADMOB_REWARDED_ID" to rewarded, "ADMOB_INTERSTITIAL_ID" to interstitial)) {
        if (!Regex("ca-app-pub-\\d{16}/\\d{10}").matches(unit)) {
            return broken("$name does not look like an AdMob ad unit id (ca-app-pub-0000000000000000/0000000000).")
        }
    }
    if (rewarded == interstitial) return broken("ADMOB_REWARDED_ID and ADMOB_INTERSTITIAL_ID are the same ad unit: each format needs its own.")
    // Google's own sample publisher: still test ads, whoever typed the ids in.
    val samplePublisher = sampleAdMobIds.appId.substringBefore('~')
    val test = listOf(app, rewarded, interstitial).any { it.startsWith(samplePublisher) }
    return AdMobIds(app, rewarded, interstitial, test, null)
}

/** What release builds of the ads flavour carry; debug builds always carry [sampleAdMobIds]. */
val adMob = findAdMobIds()
val allowTestAds = optionalSetting("allowTestAds").equals("true", ignoreCase = true)

/** Debug builds only: devices that get test ads / the test consent flow with real ids (comma separated). */
val adsTestDevices = optionalSetting("ADS_TEST_DEVICE_IDS").orEmpty()
/** Debug builds only: pretend to be in a consent region — "EEA", "REGULATED_US_STATE", "OTHER" or empty. */
val umpDebugGeography = optionalSetting("UMP_DEBUG_GEOGRAPHY").orEmpty().uppercase()

/**
 * Verification builds only (-PadsDiagForceInit=true, sample ids required): the ad SDK is started and
 * asked for ads even without a consent answer, so its start-up and failure paths can be exercised on
 * an emulator that has no network. Never set it for anything that leaves the test bench.
 */
val adsDiagForceInit = optionalSetting("adsDiagForceInit").equals("true", ignoreCase = true)

// ───────────────────────── Android ─────────────────────────

android {
    namespace = "com.zumurud.game"
    compileSdk = 37

    defaultConfig {
        applicationId = appId
        minSdk = 24
        targetSdk = appTargetSdk
        versionCode = appVersionCode
        versionName = appVersionName
    }

    signingConfigs {
        if (uploadKey != null) {
            create("release") {
                storeFile = uploadKey.storeFile
                storePassword = uploadKey.storePassword
                keyAlias = uploadKey.keyAlias
                keyPassword = uploadKey.keyPassword
            }
        }
    }

    buildFeatures {
        // BuildConfig carries the ad unit ids of the "ads" flavour.
        buildConfig = true
    }

    // One dimension: with or without the ad SDK. Both flavours contain Google Play Billing.
    //   plain  purchases only; no ad SDK and no advertising-id permission in the app
    //   ads    purchases + AdMob (GMA Next-Gen SDK) + Google's consent SDK (UMP)
    flavorDimensions += "ads"
    productFlavors {
        create("plain") {
            dimension = "ads"
        }
        create("ads") {
            dimension = "ads"
            // The consent SDK reads the AdMob app id from the manifest (src/ads/AndroidManifest.xml).
            // Sample id here; release variants replace it with the configured one (onVariants below).
            manifestPlaceholders["admobAppId"] = sampleAdMobIds.appId
        }
    }

    buildTypes {
        release {
            // R8: code shrinking, optimisation, obfuscation and resource shrinking in one switch
            // (AGP 9.3+). Extra keep rules live in src/main/keepRules/*.keep.
            optimization {
                enable = true
            }
            signingConfig = signingConfigs.getByName(if (uploadKey != null) "release" else "debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    androidResources {
        // The game speaks English and Arabic; drop every other translation the libraries bring.
        localeFilters += listOf("en", "ar")
    }

    packaging {
        resources {
            // Kotlin's reflection metadata and the coroutines debugger hook: unused at runtime.
            excludes += setOf("kotlin/**", "DebugProbesKt.bin")
        }
    }

    bundle {
        // The game has its own language switch, so both languages must be on the device:
        // keep them in the base module instead of letting Play split them out.
        language { enableSplit = false }
        density { enableSplit = true }
        abi { enableSplit = true }
    }

    lint {
        abortOnError = true
        checkReleaseBuilds = true
        warningsAsErrors = false
        lintConfig = file("lint.xml")
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_17
    }
}

dependencies {
    implementation(libs.androidx.core)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.splashscreen)
    implementation(libs.play.billing)

    "adsImplementation"(libs.gma.nextgen)
    "adsImplementation"(libs.ump)
}

// ───────────────────────── bundled web game ─────────────────────────
// The built game (../dist by default, -PWEB_DIST=… to override) is copied into a generated assets
// directory as www/, so the APK serves it at https://appassets.androidplatform.net/assets/www/.

abstract class CopyWebAssets : DefaultTask() {
    @get:Input
    abstract val sourcePath: Property<String>

    /** Tracked for up-to-date checks only; a missing directory is reported by the action below. */
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceFiles: ConfigurableFileCollection

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Inject
    abstract val files: FileSystemOperations

    @TaskAction
    fun copy() {
        val source = File(sourcePath.get())
        if (!File(source, "index.html").isFile) {
            throw GradleException(
                "The web game has not been built: ${File(source, "index.html")} does not exist.\n" +
                    "Run `npm ci && npm run build` in the match3 directory first " +
                    "(or use tools/android/build.sh, which does both steps).",
            )
        }
        files.sync {
            from(source)
            into(outputDir.dir("www"))
            // Source maps and OS litter never ship.
            exclude("**/*.map", "**/.DS_Store", "**/Thumbs.db")
        }
    }
}

val webDist: File = (gradle.startParameter.projectProperties["WEB_DIST"] ?: providers.environmentVariable("WEB_DIST").orNull)
    ?.takeIf { it.isNotBlank() }
    ?.let { File(it).let { f -> if (f.isAbsolute) f else rootProject.file(it) } }
    ?: rootProject.file("../dist")

val copyWebAssets = tasks.register<CopyWebAssets>("copyWebAssets") {
    description = "Copies the built web game into the APK assets (assets/www)."
    group = "build"
    sourcePath.set(webDist.absolutePath)
    sourceFiles.from(fileTree(webDist))
}

androidComponents {
    onVariants { variant ->
        // Every variant packages the game; AGP makes its asset merging depend on the copy task.
        variant.sources.assets?.addGeneratedSourceDirectory(copyWebAssets, CopyWebAssets::outputDir)

        if (variant.productFlavors.any { (dimension, flavour) -> dimension == "ads" && flavour == "ads" }) {
            fun text(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
            val debuggable = variant.buildType == "debug"
            // Debug builds never carry real ad ids.
            val ids = if (debuggable) sampleAdMobIds else adMob
            variant.manifestPlaceholders.put("admobAppId", ids.appId)
            val fields = variant.buildConfigFields
                ?: throw GradleException("BuildConfig generation is switched off: the ads flavour needs it")
            fields.put("ADMOB_APP_ID", BuildConfigField("String", text(ids.appId), "AdMob app id"))
            fields.put("ADMOB_REWARDED_ID", BuildConfigField("String", text(ids.rewardedId), "rewarded ad unit"))
            fields.put("ADMOB_INTERSTITIAL_ID", BuildConfigField("String", text(ids.interstitialId), "interstitial ad unit"))
            fields.put("ADS_TEST", BuildConfigField("boolean", ids.test.toString(), "true = Google's sample ids: test ads only"))
            fields.put(
                "ADS_DIAG_FORCE_INIT",
                BuildConfigField("boolean", (adsDiagForceInit && ids.test).toString(), "verification builds only"),
            )
            // Test devices and the pretended consent region exist in debug builds only.
            fields.put("ADS_TEST_DEVICE_IDS", BuildConfigField("String", text(if (debuggable) adsTestDevices else ""), "debug only"))
            fields.put("UMP_DEBUG_GEOGRAPHY", BuildConfigField("String", text(if (debuggable) umpDebugGeography else ""), "debug only"))
        }
    }
}

// ───────────────────────── helpers ─────────────────────────

if (uploadKey == null) {
    gradle.taskGraph.whenReady {
        // The tasks that actually sign a release APK or bundle (also with product flavours in the name).
        val signing = Regex("package\\w*Release(Bundle)?|sign\\w*ReleaseBundle")
        val buildsRelease = allTasks.any { it.project == project && signing.matches(it.name) }
        if (buildsRelease) {
            logger.warn(
                "\nWARNING: no upload key configured (android/keystore.properties or ZUMURUD_KEYSTORE…): " +
                    "this release build is signed with the DEBUG key — NOT FOR GOOGLE PLAY.\n",
            )
        }
    }
}

// The "ads" flavour: refuse what must never be uploaded, and say loudly when test ads are in use.
gradle.taskGraph.whenReady {
    val mine = allTasks.filter { it.project == project }
    // Every task of an ads variant carries the flavour in its name (compileAdsDebugKotlin, bundleAdsRelease…).
    val buildsAdsDebug = mine.any { Regex("[a-z]\\w*AdsDebug\\w*").matches(it.name) }
    val buildsAdsRelease = mine.any { Regex("[a-z]\\w*AdsRelease\\w*").matches(it.name) }
    if (!buildsAdsDebug && !buildsAdsRelease) return@whenReady
    adMob.problem?.let { throw GradleException("$it\n(-P, environment, android/admob.properties or gradle.properties.)") }
    if (adsDiagForceInit && buildsAdsRelease && !adMob.test) {
        throw GradleException(
            "-PadsDiagForceInit=true is for verification builds with Google's sample ad ids only: " +
                "add -PuseSampleAdIds=true -PallowTestAds=true, or drop it.",
        )
    }

    // The tasks that package a release APK or bundle of the ads flavour.
    val packagesAdsRelease = mine.any { Regex("package\\w*AdsRelease(Bundle)?|sign\\w*AdsReleaseBundle").matches(it.name) }
    if (packagesAdsRelease && adMob.test && !allowTestAds) {
        val why = if (optionalSetting("useSampleAdIds") != null) "-PuseSampleAdIds=true was given" else "the ads flavour has no AdMob ids"
        throw GradleException(
            "This release would ship Google's SAMPLE ad ids and show test ads only ($why).\n" +
                "Set ADMOB_APP_ID, ADMOB_REWARDED_ID and ADMOB_INTERSTITIAL_ID (-P, environment, android/admob.properties\n" +
                "or gradle.properties) — or, for a test build that must never be uploaded, add -PallowTestAds=true.",
        )
    }
    val forced = if (adsDiagForceInit) "!! adsDiagForceInit: the ad SDK starts WITHOUT a consent answer — test bench only.\n" else ""
    if (adMob.test) {
        logger.warn(
            "\n" + "!".repeat(78) + "\n" +
                "!! TEST ADS: " + (if (optionalSetting("useSampleAdIds") != null) "-PuseSampleAdIds=true" else "no AdMob ids are configured") +
                ", the ads flavour uses Google's SAMPLE ids.\n" +
                "!! It shows test ads only and earns nothing — NOT FOR GOOGLE PLAY.\n" +
                forced +
                "!".repeat(78) + "\n",
        )
    } else if (buildsAdsDebug) {
        logger.warn(
            "\nNOTE: debug builds of the ads flavour always use Google's SAMPLE ad ids (test ads only); " +
                "the configured AdMob ids go into release builds.\n" + forced,
        )
    }
}

// Machine-readable summary for tools/android/build.sh.
tasks.register("buildInfo") {
    description = "Prints the application id, version and signing mode."
    group = "help"
    val lines = listOf(
        "applicationId=$appId",
        "versionName=$appVersionName",
        "versionCode=$appVersionCode",
        "targetSdk=$appTargetSdk",
        "signing=${if (uploadKey != null) "upload-key" else "debug-key"}",
        "ads=${if (adMob.problem != null) "misconfigured" else if (adMob.test) "test-ids" else "real-ids"}",
    )
    doLast { lines.forEach { println(it) } }
}
