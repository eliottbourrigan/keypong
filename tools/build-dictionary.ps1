$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputPath = Join-Path $projectRoot "dictionary.js"
$tempRoot = Join-Path $env:TEMP "keypong-hunspell-fr"
$sourceBase = "https://raw.githubusercontent.com/LibreOffice/dictionaries/master/fr_FR/dictionaries"
$affPath = Join-Path $tempRoot "fr.aff"
$dicPath = Join-Path $tempRoot "fr.dic"

if (-not (Test-Path -LiteralPath $env:TEMP)) {
  throw "Temporary directory not found: $env:TEMP"
}

if (Test-Path -LiteralPath $tempRoot) {
  Remove-Item -LiteralPath $tempRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $tempRoot | Out-Null
Invoke-WebRequest -Uri "$sourceBase/fr.aff" -OutFile $affPath
Invoke-WebRequest -Uri "$sourceBase/fr.dic" -OutFile $dicPath

function ConvertTo-KeypongWord([string]$word) {
  $normalized = $word.ToLowerInvariant().Replace([string][char]0x0153, "oe").Replace([string][char]0x00E6, "ae")
  $decomposed = $normalized.Normalize([Text.NormalizationForm]::FormD)
  $builder = [Text.StringBuilder]::new()

  foreach ($character in $decomposed.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($character) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($character)
    }
  }

  $result = $builder.ToString().ToUpperInvariant()
  if ($result -match "^[A-Z]{2,24}$") { return $result }
  return $null
}

# Hunspell's French dictionary uses two-character flags. We expand direct suffix
# rules only: they cover inflections while avoiding compound and elided forms.
$suffixRules = @{}
$affLines = Get-Content -LiteralPath $affPath -Encoding UTF8

for ($index = 0; $index -lt $affLines.Count; $index += 1) {
  $parts = $affLines[$index] -split "\s+"
  if ($parts.Count -ne 4 -or $parts[0] -ne "SFX" -or $parts[2] -notin @("Y", "N")) { continue }

  $flag = $parts[1]
  $count = [int]$parts[3]
  $rules = [System.Collections.Generic.List[object]]::new()

  for ($ruleIndex = 1; $ruleIndex -le $count; $ruleIndex += 1) {
    $ruleParts = $affLines[$index + $ruleIndex] -split "\s+"
    if ($ruleParts.Count -lt 5 -or $ruleParts[0] -ne "SFX") { continue }
    $rules.Add([pscustomobject]@{
      Strip = $ruleParts[2]
      Add = ($ruleParts[3] -split "/")[0]
      Condition = $ruleParts[4]
    })
  }

  $suffixRules[$flag] = $rules
  $index += $count
}

$words = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
$entries = Get-Content -LiteralPath $dicPath -Encoding UTF8

foreach ($entry in $entries | Select-Object -Skip 1) {
  $entry = ($entry -split "\s+")[0]
  $separator = $entry.IndexOf("/")
  $word = if ($separator -eq -1) { $entry } else { $entry.Substring(0, $separator) }
  $flags = if ($separator -eq -1) { "" } else { $entry.Substring($separator + 1) }

  # Lowercase entries exclude the extensive names, places and acronyms section.
  if ($word -cnotmatch "^\p{Ll}+$") { continue }

  $keypongWord = ConvertTo-KeypongWord $word
  if ($null -ne $keypongWord) { [void]$words.Add($keypongWord) }

  for ($flagIndex = 0; $flagIndex + 1 -lt $flags.Length; $flagIndex += 2) {
    $flag = $flags.Substring($flagIndex, 2)
    if (-not $suffixRules.ContainsKey($flag)) { continue }

    foreach ($rule in $suffixRules[$flag]) {
      if ($rule.Condition -ne "." -and $word -notmatch "(?:$($rule.Condition))$") { continue }
      if ($rule.Strip -ne "0" -and -not $word.EndsWith($rule.Strip, [StringComparison]::Ordinal)) { continue }

      $stem = if ($rule.Strip -eq "0") { $word } else { $word.Substring(0, $word.Length - $rule.Strip.Length) }
      $candidate = "$stem$($rule.Add)"
      $keypongWord = ConvertTo-KeypongWord $candidate
      if ($null -ne $keypongWord) { [void]$words.Add($keypongWord) }
    }
  }
}

$sortedWords = [string[]]$words
[Array]::Sort($sortedWords, [StringComparer]::Ordinal)
$encoding = [Text.UTF8Encoding]::new($false)
$writer = [IO.StreamWriter]::new($outputPath, $false, $encoding)

try {
  $writer.WriteLine("// Generated from Grammalecte's French Hunspell dictionary. See DICTIONARY-NOTICE.md.")
  $writer.WriteLine("window.KEYPONG_WORDS = [")

  for ($index = 0; $index -lt $sortedWords.Length; $index += 1) {
    $suffix = if ($index -lt $sortedWords.Length - 1) { "," } else { "" }
    $writer.WriteLine("  `"$($sortedWords[$index])`"$suffix")
  }

  $writer.WriteLine("];" )
}
finally {
  $writer.Dispose()
}

Write-Output "Generated $($sortedWords.Length) words in $outputPath"
