# Read-only audit of measured RPM points against the original PNG.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$source = [IO.File]::ReadAllText((Join-Path $root 'rpm-image-data.js'))
$testSource = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'chart-data.test.js'))
$bitmap = [Drawing.Bitmap]::new((Join-Path $root 'autorotation-chart.png'))
$points = @()
try {
    if ($bitmap.Width -ne 750 -or $bitmap.Height -ne 1334) { throw 'Unexpected image dimensions' }
    $lines = [regex]::Matches($source, 'line\((\d+),\s*\[(.*?)\]\)', [Text.RegularExpressions.RegexOptions]::Singleline)
    if ($lines.Count -ne 13) { throw 'Expected 13 calibrated lines' }
    foreach ($line in $lines) {
        foreach ($point in [regex]::Matches($line.Groups[2].Value, '\[(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\]')) {
            $points += ,@([int]$line.Groups[1].Value, [double]::Parse($point.Groups[1].Value, [Globalization.CultureInfo]::InvariantCulture), [double]::Parse($point.Groups[2].Value, [Globalization.CultureInfo]::InvariantCulture))
        }
    }
    $registered = $points.Count
    $holdoutMatch = [regex]::Match($testSource, 'const holdouts=(\[.*?\]);', [Text.RegularExpressions.RegexOptions]::Singleline)
    if (-not $holdoutMatch.Success) { throw 'Missing independent holdout points' }
    $holdouts = $holdoutMatch.Groups[1].Value | ConvertFrom-Json
    foreach ($point in $holdouts) { $points += ,$point }
    foreach ($point in $points) {
        $pixel = $bitmap.GetPixel([int][Math]::Round($point[2]), [int]$point[1])
        if ($pixel.R -ge 100 -or $pixel.G -ge 100 -or $pixel.B -ge 100) {
            throw "Measured point is not on dark ink: RPM $($point[0]), x=$($point[2]), y=$($point[1])"
        }
    }
    Write-Output "PASS: $registered registered points + $($holdouts.Count) independent holdouts on the source image."
} finally { $bitmap.Dispose() }
