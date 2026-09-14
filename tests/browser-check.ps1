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
    $target = $null
    for ($i=0; $i -lt 100 -and -not $target; $i++) {
        Start-Sleep -Milliseconds 100
        $targets = Invoke-RestMethod "http://127.0.0.1:$port/json/list"
        $target = @($targets.value) + @($targets) | Where-Object { $_.url -like '*AutorotationCalculator/index.html' } | Select-Object -First 1
    }
    if (-not $target) { throw 'Calculator page did not open' }
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
    function Eval-Storage($expression) {
        $r = Invoke-Cdp 'Runtime.evaluate' @{expression=$expression;awaitPromise=$true;returnByValue=$true}
        if ($r.exceptionDetails) { throw ($r.exceptionDetails | ConvertTo-Json -Depth 10) }
        return $r.result.value
    }
    function Reload-Storage {
        Eval-Storage 'globalThis.__reloadPending=true' | Out-Null
        Invoke-Cdp 'Page.reload' @{} | Out-Null
        for ($i=0; $i -lt 100; $i++) {
            Start-Sleep -Milliseconds 100
            if (Eval-Storage "globalThis.__reloadPending!==true && document.readyState==='complete' && !!globalThis.AutorotationInputs && document.getElementById('densityAltitude').textContent!=='—'") { return }
        }
        throw 'Reload timed out'
    }
    $seed = @'
(()=>{
 const g=id=>document.getElementById(id);
 g('aircraftWeight').value='1650.25';g('aircraftWeight').dispatchEvent(new Event('input'));g('confirm-base').click();
 for(const [key,value] of [['crewWeight',320],['otherWeight',30],['fuelWeight',200],['pressureAltitude',1500]]){
  g(key+'-trigger').click();g('value-wheel').children[AutorotationInputs.fields[key].options.indexOf(value)].click();g('confirm-wheel').click();
 }
 g('oat-trigger').click();g('value-wheel').children[39].click();
 return localStorage.getItem(AutorotationInputs.storageKey);
})()
'@
    $saved = Eval-Storage $seed
    $read = @'
(()=>{
 const ids=['aircraftWeight','crewWeight-value','fuelWeight-value','otherWeight-value','oat-value','pressureAltitude-value','crewKg','weight-preview','densityAltitude','totalWeight','referenceRpm','rpmRange','boundary-status',...['aircraftWeight','crewWeight','fuelWeight','otherWeight','oat','pressureAltitude'].map(k=>k+'-state')];
 return JSON.stringify(ids.map(id=>{const e=document.getElementById(id);return id==='aircraftWeight'?e.value:e.textContent}));
})()
'@
    $before = Eval-Storage $read
    Reload-Storage
    if ($before -cne (Eval-Storage $read)) { throw 'Inputs, confirmation or results changed on reload' }
    if ($saved -cne (Eval-Storage 'localStorage.getItem(AutorotationInputs.storageKey)')) { throw 'Saved input state changed' }
    Write-Output 'Persistence PASS: reload restores inputs, confirmation, kg, total, DA, RPM and range'
    Invoke-Cdp 'Browser.close' @{} | Out-Null
    $socket.Dispose()
    if (-not $browser.WaitForExit(10000)) { throw 'Edge did not close' }
    $browser = Start-Process -FilePath $edgePath -WindowStyle Hidden -PassThru -ArgumentList @('--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', "--remote-debugging-port=$port", "--user-data-dir=`"$profilePath`"", $pageUrl)
    $target = $null
    for ($i=0; $i -lt 100; $i++) {
        Start-Sleep -Milliseconds 100
        try {
            $targets = Invoke-RestMethod "http://127.0.0.1:$port/json/list"
            $target = @($targets.value) + @($targets) | Where-Object { $_.url -like '*AutorotationCalculator/index.html' } | Select-Object -First 1
            if ($target) { break }
        } catch {}
    }
    if (-not $target) { throw 'Edge did not reopen' }
    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    Reload-Storage
    if ($before -cne (Eval-Storage $read)) { throw 'State changed after browser restart' }
    Write-Output 'Persistence PASS: closing and reopening Edge restores the same inputs and results'
    foreach ($invalid in @('missing','broken','out-of-range')) {
        switch ($invalid) {
            'missing' { Eval-Storage 'localStorage.removeItem(AutorotationInputs.storageKey)' | Out-Null }
            'broken' { Eval-Storage "localStorage.setItem(AutorotationInputs.storageKey,'{bad')" | Out-Null }
            'out-of-range' { Eval-Storage "(()=>{const s=JSON.parse(localStorage.getItem(AutorotationInputs.storageKey));s.values.crewWeight=999;localStorage.setItem(AutorotationInputs.storageKey,JSON.stringify(s))})()" | Out-Null }
        }
        Reload-Storage
        $ok = Eval-Storage "(()=>{const g=id=>document.getElementById(id);return g('aircraftWeight').value===''&&g('crewWeight-value').textContent==='300'&&g('fuelWeight-value').textContent==='150'&&g('otherWeight-value').textContent==='0'&&g('oat-value').textContent==='20'&&g('pressureAltitude-value').textContent==='2,000'&&g('weight-preview').textContent==='450'&&['aircraftWeight','crewWeight','fuelWeight','otherWeight','oat','pressureAltitude'].every(k=>g(k+'-state').textContent==='未確定')})()"
        if (-not $ok) { throw "Default fallback failed: $invalid" }
        Write-Output "Persistence PASS: $invalid uses defaults"
    }
} finally {
    if ($socket.State -eq [Net.WebSockets.WebSocketState]::Open) {
        try { Invoke-Cdp 'Browser.close' @{} | Out-Null } catch {}
    }
    $socket.Dispose()
}
