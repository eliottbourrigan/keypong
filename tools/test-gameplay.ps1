param([int]$Port = 9223)

$ErrorActionPreference = "Stop"
$pages = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json"
$page = @($pages | Where-Object { $_.url -like "*keypong/index.html" })[0]
if (-not $page) { throw "Keypong page not found on CDP port $Port" }

$socket = [Net.WebSockets.ClientWebSocket]::new()
$socket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
$script:messageId = 0

function Invoke-CdpExpression([string]$Expression) {
  $script:messageId += 1
  $request = @{
    id = $script:messageId
    method = "Runtime.evaluate"
    params = @{
      expression = $Expression
      returnByValue = $true
      awaitPromise = $true
    }
  } | ConvertTo-Json -Depth 6 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($request)
  $socket.SendAsync(
    [ArraySegment[byte]]::new($bytes),
    [Net.WebSockets.WebSocketMessageType]::Text,
    $true,
    [Threading.CancellationToken]::None
  ).Wait()

  do {
    $builder = [Text.StringBuilder]::new()
    do {
      $buffer = [byte[]]::new(65536)
      $result = $socket.ReceiveAsync(
        [ArraySegment[byte]]::new($buffer),
        [Threading.CancellationToken]::None
      ).Result
      [void]$builder.Append([Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count))
    } while (-not $result.EndOfMessage)
    $response = $builder.ToString() | ConvertFrom-Json
  } while ($response.id -ne $script:messageId)

  if ($response.result.exceptionDetails) {
    throw $response.result.exceptionDetails.text
  }
  return $response.result.result.value
}

[void](Invoke-CdpExpression 'location.reload(); true')
Start-Sleep -Milliseconds 1500

$setupExpression = @'
(() => {
  const game = window.keypongGame;
  const rows = {
    top: { reception: ["A", "B", "C"], send: ["G", "H", "I"] },
    bottom: { reception: ["J", "K", "L"], send: ["D", "E", "F"] }
  };
  for (const side of ["top", "bottom"]) {
    for (const role of ["reception", "send"]) {
      game.letters[side][role] = [...rows[side][role]];
      game.letterCells[side][role].forEach((cell, lane) => {
        cell.querySelector(".letter-cell__value").textContent = rows[side][role][lane];
      });
    }
  }
  game.positions = { top: 0, bottom: 2 };
  game.activeSide = "top";
  game.typedWord = "";
  game.wordState = game.emptyWordState();
  game.placeElements();
  game.updateWordState(false);
  return { dictionarySize: game.dictionary.size, side: game.activeSide };
})()
'@
$setup = Invoke-CdpExpression $setupExpression
if ($setup.dictionarySize -lt 100000 -or $setup.side -ne "top") { throw "Setup failed" }

$invalidWord = Invoke-CdpExpression '(() => { const game = window.keypongGame; game.typedWord = "AIXZZ"; game.updateWordState(false); return game.wordState; })()'
if ($invalidWord.valid -or $invalidWord.exists -or $invalidWord.targetLane -ne 2) { throw "Invalid word handling failed" }

$hardReceptionLetter = Invoke-CdpExpression '(() => { const game = window.keypongGame; for (let index = 0; index < 500; index += 1) { if (game.generateRow("reception").some((letter) => "KQWXYZ".includes(letter))) return true; } return false; })()'
if ($hardReceptionLetter) { throw "A hard letter was generated in a reception row" }

$firstWord = Invoke-CdpExpression '(() => { const game = window.keypongGame; game.typedWord = "AILE"; game.updateWordState(false); return game.wordState; })()'
if (-not $firstWord.valid -or $firstWord.targetLane -ne 2) { throw "AILE validation failed" }

$firstShot = Invoke-CdpExpression 'new Promise((resolve) => { const game = window.keypongGame; game.handleSpacePress(); game.finishCurrentShot(); setTimeout(() => resolve({ side: game.activeSide, lane: game.positions.bottom, receptionChanged: game.letters.top.reception[0] !== "A", sendChanged: game.letters.top.send[2] !== "I" }), 20); })'
if ($firstShot.side -ne "bottom" -or $firstShot.lane -ne 2 -or -not $firstShot.receptionChanged -or -not $firstShot.sendChanged) { throw "First shot failed" }

$secondWord = Invoke-CdpExpression '(() => { const game = window.keypongGame; game.typedWord = "LE"; game.updateWordState(false); return game.wordState; })()'
if (-not $secondWord.valid -or $secondWord.targetLane -ne 1) { throw "LE validation failed" }

$secondShot = Invoke-CdpExpression 'new Promise((resolve) => { const game = window.keypongGame; game.handleSpacePress(); game.finishCurrentShot(); setTimeout(() => resolve({ side: game.activeSide, lane: game.positions.top }), 20); })'
if ($secondShot.side -ne "top" -or $secondShot.lane -ne 1) { throw "Second shot failed" }

[void](Invoke-CdpExpression $setupExpression)
$powerShot = Invoke-CdpExpression '(() => { const game = window.keypongGame; game.typedWord = "AILERONS"; game.updateWordState(false); const valid = game.wordState.valid; game.handleSpacePress(); const bodyAnimations = game.getPaddle("top").querySelector("[data-paddle-body]").getAnimations(); const duration = bodyAnimations[0]?.effect.getTiming().duration ?? 0; game.finishCurrentShot(); return { valid, animationCount: bodyAnimations.length, duration }; })()'
if (-not $powerShot.valid -or $powerShot.animationCount -ne 1 -or $powerShot.duration -ne 560) { throw "Long-word paddle spin failed" }

$socket.Dispose()
Write-Output "Gameplay smoke test passed: AILE, LE, and 7+ letter paddle spin."
