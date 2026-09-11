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
    Invoke-Cdp 'Emulation.setDeviceMetricsOverride' @{width=1100;height=900;deviceScaleFactor=1;mobile=$false} | Out-Null
    $expression = @'
(async () => {
  for (let i=0; i<100; i++) {
    const image = document.getElementById('performance-chart');
    if (image?.complete && image.naturalWidth === 750 && globalThis.AutorotationChartView) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const get = id => document.getElementById(id);
  const checks = [];
  function check(name, condition) { if (!condition) throw Error(name); checks.push(name); }
  function input(weight, altitude=0, oat=15) {
    const values = {pressureAltitude:altitude, oat, aircraftWeight:weight-200, crewWeight:100, fuelWeight:100};
    for (const [id,value] of Object.entries(values)) get(id).value = value;
    get('conditions').dispatchEvent(new Event('input', {bubbles:true}));
    const dot = get('chart-dot'), image = get('performance-chart');
    const dr = dot.getBoundingClientRect(), ir = image.getBoundingClientRect();
    return {x:parseFloat(dot.style.left)*image.naturalWidth/100,
      y:parseFloat(dot.style.top)*image.naturalHeight/100,
      visible:!dot.hidden && dr.width>0,
      screenX:dr.left+dr.width/2, screenY:dr.top+dr.height/2,
      imageLeft:ir.left,imageTop:ir.top,imageWidth:ir.width,imageHeight:ir.height};
  }
  const base=input(2200);
  check('Image and red dot rendered', base.visible && getComputedStyle(get('chart-dot')).backgroundColor==='rgb(227, 45, 50)');
  check('Dot center aligned to image coordinates', Math.abs(base.screenX-base.imageLeft-base.x/750*base.imageWidth)<1 && Math.abs(base.screenY-base.imageTop-base.y/1334*base.imageHeight)<1);
  const right=input(2400),left=input(2000);
  check('Weight moves horizontally both ways',right.x>base.x && left.x<base.x && right.y===base.y && left.y===base.y);
  const hot=input(2200,0,25),cold=input(2200,0,5);
  check('OAT moves vertically both ways',hot.y<base.y && cold.y>base.y && hot.x===base.x && cold.x===base.x);
  const high=input(2200,1000,15),low=input(2200,-1000,15);
  check('Pressure altitude moves vertically both ways',high.y<base.y && low.y>base.y && high.x===base.x && low.x===base.x);
  const repeated=input(2200);
  check('Same inputs same point',repeated.x===base.x && repeated.y===base.y);
  const beyond=input(2507.75);
  check('MAXIMUM exceeded still renders',beyond.visible && get('boundary-status').textContent==='385 RPM MAXIMUM超過' && get('referenceRpm').textContent==='387.5');
  const outside=input(2601);
  check('Outside X hidden without clipping',!outside.visible && get('chart-view-status').textContent==='チャート表示範囲外' && get('chart-dot').style.left==='');
  const above=input(2200,0,60);
  check('Outside Y hidden without clipping',!above.visible && get('chart-view-status').textContent==='チャート表示範囲外');
  const coordinates = [[2200,0,15],[2400,-1000,16.98],[2000,3000,9.06]].map(([weight,altitude,oat]) => {
    const p=input(weight,altitude,oat);
    const densityAltitudeFt=globalThis.AutorotationCalculator.densityAltitude(altitude,oat); const projected=globalThis.AutorotationChartView.project({grossWeightLb:weight,densityAltitudeFt},globalThis.AutorotationChartViewConfig); return {weightLb:weight,densityAltitudeFt,x:projected.leftPercent*750/100,y:projected.topPercent*1334/100};
  });
  input(2507.75);
  get('chart-dot').scrollIntoView({block:'center'});
  return {checks,coordinates};
})()
'@
    $evaluation = Invoke-Cdp 'Runtime.evaluate' @{expression=$expression;awaitPromise=$true;returnByValue=$true}
    if ($evaluation.exceptionDetails) { throw ($evaluation.exceptionDetails | ConvertTo-Json -Depth 10) }
    $evaluation.result.value | ConvertTo-Json -Depth 10
    $screenshot = Invoke-Cdp 'Page.captureScreenshot' @{format='png';captureBeyondViewport=$false}
    $desktopPath = Join-Path $profilePath 'desktop.png'
    [IO.File]::WriteAllBytes($desktopPath, [Convert]::FromBase64String($screenshot.data))
    Write-Output "Desktop screenshot: $desktopPath"
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
