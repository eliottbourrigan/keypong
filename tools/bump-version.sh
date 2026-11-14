#!/bin/sh
# Met à jour le ?v= de styles.css et script.js dans index.html (contourne le cache mobile).
# À lancer avant chaque commit qui touche au JS ou au CSS.
v=$(date +%Y%m%d%H%M%S)
sed -i -E "s#(styles\.css|script\.js)(\?v=[0-9]+)?\"#\1?v=$v\"#" "$(dirname "$0")/../index.html"
echo "version $v"
