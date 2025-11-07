param (
    [Parameter(Mandatory = $true)]
    [string]$Command,

    [int]$TimeoutSeconds = 600
)

Write-Host "Starting command with timeout $TimeoutSeconds seconds:"
Write-Host "  $Command"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "pwsh"
$psi.Arguments = "-NoLogo -NoProfile -Command $Command"
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $psi
$null = $process.Start()

$outputReader = $process.StandardOutput
$errorReader = $process.StandardError

$completed = $process.WaitForExit($TimeoutSeconds * 1000)

if (-not $completed) {
    Write-Warning "Command exceeded timeout. Attempting to terminate."
    try {
        if ($process.HasExited -eq $false) {
            try {
                $process.Kill($true)
            } catch {
                Write-Warning "Kill(true) not supported, falling back to Kill()."
                $process.Kill()
            }
        }
        $process.WaitForExit(5000) | Out-Null
        Write-Warning "Process terminated after timeout."
    } catch {
        Write-Warning "Failed to terminate process: $_"
    }
}

Write-Output $outputReader.ReadToEnd()
Write-Error $errorReader.ReadToEnd()

if ($completed) {
    exit $process.ExitCode
} else {
    exit 124
}
