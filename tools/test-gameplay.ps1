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
    top: ["A", "B", "C", "G", "H", "L"],
    bottom: ["J", "K", "M", "D", "E", "I"]
  };
  for (const side of ["top", "bottom"]) {
    game.letters[side] = [...rows[side]];
    game.letterCells[side].forEach((cell, index) => {
      cell.querySelector(".letter-cell__value").textContent = rows[side][index];
    });
  }
  game.positions = { top: 0, bottom: 2 };
  game.requiredStartIndex = { top: null, bottom: null };
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
if ($invalidWord.valid -or $invalidWord.exists -or $invalidWord.targetLetterIndex -ne 5) { throw "Invalid word handling failed" }

$uniqueLetters = Invoke-CdpExpression '(() => { const game = window.keypongGame; return Array.from({ length: 100 }, () => game.generateLetters()).every((letters) => new Set(letters).size === 6); })()'
if (-not $uniqueLetters) { throw "A camp received duplicate letters" }

$firstWord = Invoke-CdpExpression '(() => { const game = window.keypongGame; game.typedWord = "AILE"; game.updateWordState(false); return game.wordState; })()'
if (-not $firstWord.valid -or $firstWord.startLetterIndex -ne 0 -or $firstWord.targetLetterIndex -ne 5) { throw "AILE validation failed" }

$firstShot = Invoke-CdpExpression 'new Promise((resolve) => { const game = window.keypongGame; game.handleSpacePress(); game.finishCurrentShot(); setTimeout(() => resolve({ side: game.activeSide, lane: game.positions.bottom, startingLetterChanged: game.letters.top[0] !== "A", targetLetterUnchanged: game.letters.bottom[5] === "I", requiredStart: game.requiredStartIndex.bottom }), 20); })'
if ($firstShot.side -ne "bottom" -or $firstShot.lane -ne 5 -or -not $firstShot.startingLetterChanged -or -not $firstShot.targetLetterUnchanged -or $firstShot.requiredStart -ne 5) { throw "First shot failed" }

$secondWord = Invoke-CdpExpression '(() => { const game = window.keypongGame; game.typedWord = "ILE"; game.updateWordState(false); return game.wordState; })()'
if (-not $secondWord.valid -or $secondWord.startLetterIndex -ne 5 -or $secondWord.targetLetterIndex -ne 5) { throw "ILE validation failed" }

$secondShot = Invoke-CdpExpression 'new Promise((resolve) => { const game = window.keypongGame; game.handleSpacePress(); game.finishCurrentShot(); setTimeout(() => resolve({ side: game.activeSide, lane: game.positions.top, startingLetterChanged: game.letters.bottom[5] !== "I", targetLetterUnchanged: game.letters.top[5] === "L", requiredStart: game.requiredStartIndex.top }), 20); })'
if ($secondShot.side -ne "top" -or $secondShot.lane -ne 5 -or -not $secondShot.startingLetterChanged -or -not $secondShot.targetLetterUnchanged -or $secondShot.requiredStart -ne 5) { throw "Second shot failed" }

[void](Invoke-CdpExpression $setupExpression)
$dropShot = Invoke-CdpExpression '(() => { const game = window.keypongGame; game.typedWord = "AI"; game.updateWordState(false); const valid = game.wordState.valid; game.handleSpacePress(); const callout = game.elements.shotCallout; const result = { valid, text: callout.textContent, visible: callout.classList.contains("is-visible") }; game.finishCurrentShot(); return result; })()'
if (-not $dropShot.valid -or $dropShot.text -ne "AMORTI !" -or -not $dropShot.visible) { throw "Two-letter drop-shot callout failed" }

[void](Invoke-CdpExpression $setupExpression)
$powerShot = Invoke-CdpExpression '(() => { const game = window.keypongGame; game.typedWord = "AILERONS"; game.updateWordState(false); const valid = game.wordState.valid; game.handleSpacePress(); const bodyAnimations = game.getPaddle("top").querySelector("[data-paddle-body]").getAnimations(); const duration = bodyAnimations[0]?.effect.getTiming().duration ?? 0; const callout = game.elements.shotCallout; const result = { valid, animationCount: bodyAnimations.length, duration, text: callout.textContent, visible: callout.classList.contains("is-visible") }; game.finishCurrentShot(); return result; })()'
if (-not $powerShot.valid -or $powerShot.animationCount -ne 1 -or $powerShot.duration -ne 560 -or $powerShot.text -ne "SMASH !" -or -not $powerShot.visible) { throw "Long-word smash callout failed" }

$socket.Dispose()
Write-Output "Gameplay smoke test passed: cross-camp letters, delayed replacement, and 7+ letter paddle spin."
