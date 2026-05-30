# Creates a Desktop shortcut for marka.md that launches the dev build
# via wscript.exe + launch-hidden.vbs (no visible terminal).
$ErrorActionPreference = "Stop"

$projectDir = "C:\Users\umuti\Projects\markamd"
$vbs        = Join-Path $projectDir "scripts\launch-hidden.vbs"
$icon       = Join-Path $projectDir "src-tauri\icons\icon.ico"
$desktop    = [Environment]::GetFolderPath("Desktop")
$lnkPath    = Join-Path $desktop "marka.md.lnk"

$wsh = New-Object -ComObject WScript.Shell
$lnk = $wsh.CreateShortcut($lnkPath)
$lnk.TargetPath       = "C:\Windows\System32\wscript.exe"
$lnk.Arguments        = '"' + $vbs + '"'
$lnk.WorkingDirectory = $projectDir
$lnk.IconLocation     = "$icon,0"
$lnk.Description      = "marka.md (dev)"
$lnk.WindowStyle      = 7   # minimized, no focus — wscript itself runs hidden via the vbs
$lnk.Save()

Write-Host "created: $lnkPath"
