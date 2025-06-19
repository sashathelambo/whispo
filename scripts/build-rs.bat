@echo off
if not exist "resources\bin" mkdir "resources\bin"
cd whispo-rs
cargo build --release
if exist "target\release\whispo-rs.exe" (
    copy "target\release\whispo-rs.exe" "..\resources\bin\whispo-rs.exe"
    echo Successfully built and copied whispo-rs.exe
) else (
    echo Build failed or binary not found
)
