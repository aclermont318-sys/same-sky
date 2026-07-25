# Same Sky - finishes the sync setup after you've created the Supabase project.
#
# Run:  powershell -ExecutionPolicy Bypass -File tools\finish-sync-setup.ps1
# Or:   ... -Url https://xxxx.supabase.co -AnonKey eyJ...
#
param(
    [string]$Url,
    [string]$AnonKey
)
#
# You paste two values from your own Supabase dashboard into YOUR terminal (they are
# never sent anywhere else). The script then writes js/config.js, invents a strong
# couple code, checks the database really answers, and tells you what to send your
# partner. ASCII only on purpose - PowerShell 5.1 mangles fancy dashes.

$ErrorActionPreference = 'Stop'
$appDir = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $appDir 'js\config.js'

Write-Output ''
Write-Output '  Same Sky - connecting your two devices'
Write-Output '  ======================================'
Write-Output ''
Write-Output '  From your Supabase dashboard: Project Settings -> API'
Write-Output ''

if ($Url) { $url = $Url.Trim() } else { $url = (Read-Host '  Project URL (https://xxxx.supabase.co)').Trim() }
if ($url -notmatch '^https://[a-z0-9-]+\.supabase\.co/?$') {
    throw "That does not look like a project URL. It should end in .supabase.co"
}
$url = $url.TrimEnd('/')

if ($AnonKey) { $anon = $AnonKey.Trim() } else { $anon = (Read-Host '  anon public key (the long eyJ... string)').Trim() }
if ($anon.Length -lt 40) { throw 'That anon key looks too short - copy the whole thing.' }

# The couple code is the secret that separates your world from everyone else's.
# Generated here so it is long and unguessable rather than a memorable word.
$existing = Get-Content $configPath -Raw
$codeMatch = [regex]::Match($existing, "COUPLE_CODE\s*=\s*'([^']+)'")
if ($codeMatch.Success -and $codeMatch.Groups[1].Value.Length -gt 12) {
    $code = $codeMatch.Groups[1].Value
    Write-Output ''
    Write-Output "  Keeping the couple code already in config.js."
} else {
    $bytes = New-Object byte[] 18
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $code = 'samesky-' + ([System.BitConverter]::ToString($bytes) -replace '-', '').ToLower().Substring(0, 24)
}

Write-Output ''
Write-Output '  Checking the database answers...'
try {
    $probe = Invoke-WebRequest -Uri "$url/rest/v1/couple_data?select=key&limit=1" `
        -Headers @{ apikey = $anon; Authorization = "Bearer $anon" } `
        -UseBasicParsing -TimeoutSec 15
    Write-Output "  OK - table couple_data is reachable (HTTP $($probe.StatusCode))."
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 401 -or $status -eq 403) {
        Write-Output '  Reached the project, but it refused the request.'
        Write-Output '  That is expected until you are signed in - the app signs in by itself.'
    } elseif ($status -eq 404) {
        throw "Reached the project but there is no couple_data table yet. Run the SQL from docs/SETUP-SYNC.md (Step 1) first."
    } else {
        throw "Could not reach $url - check the URL and your internet. ($($_.Exception.Message))"
    }
}

$content = @"
// Same Sky - the only file you edit to switch sync on.
//
// Written by tools/finish-sync-setup.ps1. Empty these three values again and the
// app goes straight back to being private and on-device; nothing is deleted.
//
// The anon key is meant to be public - it only permits what the database's row
// policies allow. The COUPLE_CODE is the real secret: anyone who knows it can read
// your app's contents, so keep it between the two of you.

export const SUPABASE_URL = '$url';
export const SUPABASE_ANON_KEY = '$anon';
export const COUPLE_CODE = '$code';

export const syncConfigured = () =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && COUPLE_CODE);
"@

Set-Content -Path $configPath -Value $content -Encoding utf8

Write-Output ''
Write-Output '  Done. js/config.js is written.'
Write-Output ''
Write-Output '  YOUR COUPLE CODE (both devices must use exactly this):'
Write-Output ''
Write-Output "      $code"
Write-Output ''
Write-Output '  Next:'
Write-Output '   1. Close and reopen Same Sky. Settings -> Sharing should show a green dot.'
Write-Output '   2. Put the app online so her phone can open it:'
Write-Output '      drag the same-sky folder onto https://app.netlify.com/drop'
Write-Output '   3. Send her the link. On her phone: Share -> Add to Home Screen.'
Write-Output '   4. Both of you: Settings -> Sharing -> turn on notifications.'
Write-Output ''
Write-Output '  Keep the couple code private - it is the key to your world.'
Write-Output ''
