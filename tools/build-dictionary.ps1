$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputPath = Join-Path $projectRoot "dictionary.js"
$tempRoot = Join-Path $env:TEMP "keypong-lexique383"
$archivePath = Join-Path $tempRoot "Lexique383.zip"
$sourceUrl = "https://www.lexique.org/databases/Lexique383/Lexique383.zip"

if (-not (Test-Path -LiteralPath $env:TEMP)) {
  throw "Temporary directory not found: $env:TEMP"
}

if (Test-Path -LiteralPath $tempRoot) {
  Remove-Item -LiteralPath $tempRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $tempRoot | Out-Null
Invoke-WebRequest -Uri $sourceUrl -OutFile $archivePath
Expand-Archive -LiteralPath $archivePath -DestinationPath $tempRoot

$sourceFile = Get-ChildItem -LiteralPath $tempRoot -Filter "Lexique383.tsv" -Recurse | Select-Object -First 1
if (-not $sourceFile) {
  throw "Lexique383.tsv was not found in the downloaded archive."
}

$words = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
$rows = Import-Csv -LiteralPath $sourceFile.FullName -Delimiter "`t" -Encoding UTF8

foreach ($row in $rows) {
  $word = $row.ortho.ToLowerInvariant().Replace([string][char]0x0153, "oe").Replace([string][char]0x00E6, "ae")
  $decomposed = $word.Normalize([Text.NormalizationForm]::FormD)
  $builder = [Text.StringBuilder]::new()

  foreach ($character in $decomposed.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($character) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($character)
    }
  }

  $normalized = $builder.ToString().ToUpperInvariant()
  if ($normalized -match "^[A-Z]{2,}$") {
    [void]$words.Add($normalized)
  }
}

$sortedWords = [string[]]$words
[Array]::Sort($sortedWords, [StringComparer]::Ordinal)
$encoding = [Text.UTF8Encoding]::new($false)
$writer = [IO.StreamWriter]::new($outputPath, $false, $encoding)

try {
  $writer.WriteLine("// Generated from Lexique 3.83. See DICTIONARY-NOTICE.md.")
  $writer.WriteLine("window.KEYPONG_WORDS = [")

  for ($index = 0; $index -lt $sortedWords.Length; $index += 1) {
    $suffix = if ($index -lt $sortedWords.Length - 1) { "," } else { "" }
    $writer.WriteLine("  `"$($sortedWords[$index])`"$suffix")
  }

  $writer.WriteLine("];")
}
finally {
  $writer.Dispose()
}

Write-Output "Generated $($sortedWords.Length) words in $outputPath"
