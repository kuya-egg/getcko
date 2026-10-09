fn main() {
    // The dev path of the speech helper (scripts/build-whisper.sh) carries the target triple.
    println!(
        "cargo:rustc-env=GETCKO_TARGET={}",
        std::env::var("TARGET").expect("cargo sets TARGET for build scripts")
    );
    link_clang_runtime();
    tauri_build::build()
}

/// llama.cpp's Metal code checks `@available(macOS 15.0)`, which clang turns into a call
/// to `__isPlatformVersionAtLeast` whenever the minimum macOS version is lower (`tauri
/// build` targets 10.13). That function lives in clang's runtime library, which rustc
/// does not link: a clean `bun run tauri:build` failed with it undefined. Linking the
/// library keeps macOS 14 and older supported instead of raising the minimum to 15.
fn link_clang_runtime() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("macos") {
        return;
    }
    let dir = std::process::Command::new("xcrun")
        .args(["clang", "--print-runtime-dir"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|dir| dir.trim().to_owned())
        .filter(|dir| !dir.is_empty());
    match dir {
        Some(dir) => {
            println!("cargo:rustc-link-search=native={dir}");
            println!("cargo:rustc-link-lib=static=clang_rt.osx");
        }
        None => println!(
            "cargo:warning=clang's runtime directory not found (xcrun clang --print-runtime-dir); linking may fail"
        ),
    }
}
