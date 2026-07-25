# Same Sky — installs desktop + Start Menu shortcuts for this laptop.
# Run:  powershell -ExecutionPolicy Bypass -File tools\install.ps1
# Undo: powershell -ExecutionPolicy Bypass -File tools\install.ps1 -Uninstall

param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'

$appDir   = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $appDir 'tools\samesky_launch.pyw'
$icon     = Join-Path $appDir 'icons\same-sky.ico'
$desktop  = [Environment]::GetFolderPath('Desktop')
$programs = [Environment]::GetFolderPath('Programs')
$targets  = @((Join-Path $desktop 'Same Sky.lnk'), (Join-Path $programs 'Same Sky.lnk'))

if ($Uninstall) {
    foreach ($t in $targets) { if (Test-Path $t) { Remove-Item $t -Force; Write-Output "removed $t" } }
    Write-Output 'Same Sky shortcuts removed. The app folder itself was left untouched.'
    return
}

# Locate a windowed Python (pythonw.exe = no console flash).
$pyw = $null
$cand = @()
$cmd = Get-Command python -ErrorAction SilentlyContinue
if ($cmd) {
    $real = & $cmd.Source -c "import sys, os; print(os.path.join(os.path.dirname(sys.executable), 'pythonw.exe'))"
    $cand += $real
}
$cmdw = Get-Command pythonw -ErrorAction SilentlyContinue
if ($cmdw) { $cand += $cmdw.Source }
foreach ($c in $cand) { if ($c -and (Test-Path $c)) { $pyw = $c; break } }
if (-not $pyw) { throw 'Could not find pythonw.exe — install Python 3 and re-run.' }

foreach ($p in @($launcher, $icon)) { if (-not (Test-Path $p)) { throw "Missing required file: $p" } }

$shell = New-Object -ComObject WScript.Shell
foreach ($t in $targets) {
    $sc = $shell.CreateShortcut($t)
    $sc.TargetPath       = $pyw
    $sc.Arguments        = '"' + $launcher + '"'
    $sc.WorkingDirectory = $appDir
    $sc.IconLocation     = "$icon,0"
    $sc.Description      = 'Same Sky — two hearts, one sky'
    $sc.WindowStyle      = 7   # minimized: the launcher is windowless anyway
    $sc.Save()
    Write-Output "created $t"
}

Write-Output ''
Write-Output 'Installed. Double-click "Same Sky" on your desktop (or find it in the Start Menu).'
Write-Output "Python: $pyw"
Write-Output "App:    $appDir"
