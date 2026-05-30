' marka.md — hidden launcher
' Runs `npm run tauri dev` from the project root with no visible terminal.
' Invoked by the desktop shortcut via wscript.exe.

Option Explicit

Dim sh, projectDir
Set sh = CreateObject("WScript.Shell")
projectDir = "C:\Users\umuti\Projects\markamd"

sh.CurrentDirectory = projectDir
' window style 0 = hidden, third arg False = don't wait
sh.Run "cmd /c npm run tauri dev", 0, False
