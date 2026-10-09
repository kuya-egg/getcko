fn main() {
    // The dev path of the speech helper (scripts/build-whisper.sh) carries the target triple.
    println!(
        "cargo:rustc-env=GETCKO_TARGET={}",
        std::env::var("TARGET").expect("cargo sets TARGET for build scripts")
    );
    tauri_build::build()
}
