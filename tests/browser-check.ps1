# Real Edge/Chromium rendering check. Outputs and the temporary browser profile
# are written under the Windows temporary directory, never into application files.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$profilePath = Join-Path ([System.IO.Path]::GetTempPath()) ('autorotation-browser-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $profilePath | Out-Null
$pageUrl = ([Uri](Join-Path $projectRoot 'index.html')).AbsoluteUri
$browser = Start-Process -FilePath $edgePath -WindowStyle Hidden -PassThru -ArgumentList @('--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', "--user-data-dir=`"$profilePath`"", $pageUrl)
$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$script:messageId = 0
function Invoke-Cdp($method, $parameters) {
    $script:messageId++
    $id = $script:messageId
    $request = @{ id=$id; method=$method; params=$parameters } | ConvertTo-Json -Depth 20 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($request)
    $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    do {
        $stream = [IO.MemoryStream]::new()
        do {
            $buffer = [byte[]]::new(65536)
            $read = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
            if ($read.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close) { throw 'Browser connection closed' }
            $stream.Write($buffer, 0, $read.Count)
        } until ($read.EndOfMessage)
        $response = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
        $stream.Dispose()
    } until ($response.id -eq $id)
    if ($response.error) { throw ($response.error | ConvertTo-Json -Compress) }
    return $response.result
}
try {
    $portFile = Join-Path $profilePath 'DevToolsActivePort'
    for ($attempt=0; $attempt -lt 80 -and -not (Test-Path $portFile); $attempt++) { Start-Sleep -Milliseconds 250 }
    if (-not (Test-Path $portFile)) { throw 'Edge debugging endpoint did not start' }
    $port = (Get-Content $portFile)[0]
    $targets = Invoke-RestMethod "http://127.0.0.1:$port/json/list"
    $target = $targets | Where-Object type -eq 'page' | Select-Object -First 1
    $socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    Invoke-Cdp 'Emulation.setDeviceMetricsOverride' @{width=390;height=844;deviceScaleFactor=1;mobile=$false} | Out-Null
    $expression = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'app.test.js'))
    $evaluation = Invoke-Cdp 'Runtime.evaluate' @{expression=$expression;awaitPromise=$true;returnByValue=$true}
    if ($evaluation.exceptionDetails) { throw ($evaluation.exceptionDetails | ConvertTo-Json -Depth 10) }
    $evaluation.result.value | ConvertTo-Json -Depth 10
    $screenshot = Invoke-Cdp 'Page.captureScreenshot' @{format='png';captureBeyondViewport=$false}
    $desktopPath = Join-Path $profilePath 'mobile-inputs.png'
    [IO.File]::WriteAllBytes($desktopPath, [Convert]::FromBase64String($screenshot.data))
    Write-Output "Mobile inputs screenshot: $desktopPath"
    Invoke-Cdp 'Runtime.evaluate' @{expression="document.getElementById('crewWeight-trigger').click()"} | Out-Null
    $wheelShot = Invoke-Cdp 'Page.captureScreenshot' @{format='png';captureBeyondViewport=$false}
    $wheelPath = Join-Path $profilePath 'mobile-wheel.png'
    [IO.File]::WriteAllBytes($wheelPath, [Convert]::FromBase64String($wheelShot.data))
    Write-Output "Wheel screenshot: $wheelPath"
    Invoke-Cdp 'Runtime.evaluate' @{expression="document.getElementById('cancel-wheel').click()"} | Out-Null
    Invoke-Cdp 'Emulation.setDeviceMetricsOverride' @{width=320;height=740;deviceScaleFactor=1;mobile=$false} | Out-Null
    $narrow = Invoke-Cdp 'Runtime.evaluate' @{expression="document.documentElement.scrollWidth <= innerWidth";returnByValue=$true}
    if (-not $narrow.result.value) { throw '320px horizontal overflow' }
    Write-Output '320px width: no horizontal overflow'
    Invoke-Cdp 'Emulation.setDeviceMetricsOverride' @{width=390;height=844;deviceScaleFactor=1;mobile=$false} | Out-Null
    $mobile = Invoke-Cdp 'Runtime.evaluate' @{expression="new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => { const d=document.getElementById('chart-dot'),i=document.getElementById('performance-chart');d.scrollIntoView({block:'center'});const r=d.getBoundingClientRect(),s=i.getBoundingClientRect();resolve({visible:!d.hidden,dx:Math.abs(r.left+r.width/2-s.left-parseFloat(d.style.left)/100*s.width),dy:Math.abs(r.top+r.height/2-s.top-parseFloat(d.style.top)/100*s.height)}); })))";awaitPromise=$true;returnByValue=$true}
    if ($mobile.exceptionDetails) { throw 'Mobile evaluation failed' }
    $position = $mobile.result.value
    if (-not $position.visible -or $position.dx -ge 1 -or $position.dy -ge 1) { throw 'Mobile dot alignment failed' }
    Write-Output "Mobile alignment PASS: dx=$($position.dx), dy=$($position.dy) px"
    $screenshot = Invoke-Cdp 'Page.captureScreenshot' @{format='png';captureBeyondViewport=$false}
    $mobilePath = Join-Path $profilePath 'mobile.png'
    [IO.File]::WriteAllBytes($mobilePath, [Convert]::FromBase64String($screenshot.data))
    Write-Output "Mobile screenshot: $mobilePath"
} finally {
    if ($socket.State -eq [Net.WebSockets.WebSocketState]::Open) {
        try { Invoke-Cdp 'Browser.close' @{} | Out-Null } catch {}
    }
    $socket.Dispose()
}
