@echo off
rem Windows version of build-whisper.sh: builds GetCko's speech-to-text helper
rem (src-tauri/sidecars/whisper) into src-tauri/binaries/getcko-whisper-<triple>.exe.
rem Run from a plain Command Prompt or PowerShell, not Git Bash: Git's own link.exe
rem would shadow the MSVC linker. Needs Visual Studio Build Tools (C++), CMake, LLVM.
setlocal enabledelayedexpansion

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
for /f "usebackq delims=" %%v in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VS=%%v"
if not defined VS (echo Visual Studio Build Tools not found & exit /b 1)
call "%VS%\VC\Auxiliary\Build\vcvars64.bat" >nul || exit /b 1

if not defined LIBCLANG_PATH set "LIBCLANG_PATH=%ProgramFiles%\LLVM\bin"
set "PATH=%ProgramFiles%\CMake\bin;%LIBCLANG_PATH%;%USERPROFILE%\.cargo\bin;%PATH%"
rem The helper keeps its own target folder; a shared CARGO_TARGET_DIR would move it.
set CARGO_TARGET_DIR=
rem whisper-rs-sys runs bindgen without the MSVC include folders; pass them on.
set ARGS=
for %%i in ("%INCLUDE:;=" "%") do if not "%%~i"=="" set ARGS=!ARGS! "-I%%~i"
set "BINDGEN_EXTRA_CLANG_ARGS=!ARGS!"

cd /d "%~dp0.."
cargo build --release --manifest-path src-tauri\sidecars\whisper\Cargo.toml || exit /b 1
for /f "tokens=2" %%t in ('rustc -vV ^| findstr /b "host:"') do set "TRIPLE=%%t"
if not exist src-tauri\binaries mkdir src-tauri\binaries
copy /y src-tauri\sidecars\whisper\target\release\getcko-whisper.exe "src-tauri\binaries\getcko-whisper-%TRIPLE%.exe" >nul || exit /b 1
echo ok       src-tauri\binaries\getcko-whisper-%TRIPLE%.exe
