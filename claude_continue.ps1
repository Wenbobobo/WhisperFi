$ErrorActionPreference = "Stop"
Set-Location "D:\zWenbo\AI\Private Defi"

$claude = "D:\npm-global\claude.ps1"

$logDir = ".\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ("claude_" + (Get-Date -Format "yyyyMMdd") + ".log")

"[$(Get-Date -Format s)] start user=$env:USERNAME cwd=$(Get-Location)" | Out-File $log -Append -Encoding utf8
& $claude -c --dangerously-skip-permissions --model opusplan "Continue" *>> $log
"[$(Get-Date -Format s)] done exitcode=$LASTEXITCODE" | Out-File $log -Append -Encoding utf8
exit $LASTEXITCODE
