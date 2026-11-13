import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    // AGP 9 has built-in Kotlin: no org.jetbrains.kotlin.android plugin.
    alias(libs.plugins.android.application)
}

// ───────────────────────── configurable values ─────────────────────────

/** Command line (-PNAME=…) wins, then the environment variable NAME, then gradle.properties. */
fun setting(name: String): String {
    val fromCommandLine = gradle.startParameter.projectProperties[name]
    val fromEnvironment = providers.environmentVariable(name).orNull
    return listOf(fromCommandLine, fromEnvironment, providers.gradleProperty(name).orNull)
        .firstOrNull { !it.isNullOrBlank() }
        ?.trim()
        ?: throw GradleException("Missing build setting $name (see android/gradle.properties)")
}

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
        textReport = true
        htmlReport = true
        xmlReport = false
        sarifReport = false
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
    )
    doLast { lines.forEach { println(it) } }
}
