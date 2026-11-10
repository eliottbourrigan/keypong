# French dictionary

`dictionary.js` is generated from the French Hunspell dictionary **Classique
v7.7**, created by Olivier R. for Grammalecte and distributed with LibreOffice.

- Project: https://grammalecte.net/
- Source: https://github.com/LibreOffice/dictionaries/tree/master/fr_FR/dictionaries
- License: Mozilla Public License 2.0
- License text: https://www.mozilla.org/MPL/2.0/

The generator expands direct Hunspell suffix rules to include plural and verbal
forms. It retains lowercase lexical entries only, folds ligatures and diacritics
to uppercase ASCII, excludes punctuation, numbers and words longer than 24
letters, then removes duplicates. The transformation script is available at
`tools/build-dictionary.ps1`.

The generated dictionary remains available under MPL-2.0.
