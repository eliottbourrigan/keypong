# Keypong — idées

Fichier de référence pour toutes les idées du projet. On y ajoute, on n'y supprime que ce qui est abandonné.

## 1. Multijoueur en ligne

- Ouvert au public, sans viser un gros succès.
- Backend envisagé : serveur WebSocket Node (ou PartyKit / Cloudflare) pour réutiliser `dictionary.js` et les règles côté serveur (serveur autoritaire). Alternative rapide : Supabase Realtime (triche possible).
- Prérequis : sortir la logique pure (état, règles, validation) de `PingPongScene` dans un module sans DOM, partagé client/serveur.

## 2. Raretés des lettres

Idée : 4 raretés, fondées sur la fréquence des lettres dans le dictionnaire (en %). Elles servent à pondérer le tirage de la grille et à alimenter les cartes liées aux « lettres rares ».

| Rareté | Lettres | Fréquence dictionnaire |
| --- | --- | --- |
| Commune | E A I S R N T O | de 6 % à 15 % chacune |
| Peu commune | L U C M P D | de 2 % à 4 % |
| Rare | G B F H V | de 1 % à 1,6 % |
| Très rare | Z Q Y X J K W | moins de 1 % |

Pistes :
- Très rares (X, Y, W, K, J, Q, Z) : fort bonus quand on les joue, mais peu présentes dans la grille.
- Couleur ou halo différent par rareté sur la grille.
- Note : le tirage actuel (`letterPool`) ne contient ni X ni Z ; les ajouter est un choix de design.
- Les raretés alimentent les cartes « Lettre précieuse », « Collectionneur de lettres », « Alphabet complet ».

## 3. Mode roguelike

### Concept
Une partie en plusieurs manches. Entre les manches (ou après un échange marquant), 3 cartes sont proposées et une seule est gardée pour la suite. Chaque carte modifie une règle, récompense une façon d'écrire ou ajoute une interaction avec la table.

La vitesse de frappe est la statistique centrale : balle rapide = peu de temps pour répondre ; balle lente = préparation, effets, défense. Les cartes agissent aussi sur les lettres, mots, cases, trajectoires, rebonds et conditions de victoire.

### Progression
- Raretés : commune, peu commune, rare, épique, légendaire. Les rares et au-dessus apparaissent surtout plus tard dans la partie.
- Évolution, synergies et fusions de cartes ; quelques cartes à contrepartie.
- Éviter une stratégie optimale unique ; favoriser des builds spécialisés.

### Familles de cartes (exemples)
- **Longueur des mots** : Élan lexical (mots longs = plus vite), Service express (mots courts), Compression, Dent de scie, Décalettres (légendaire : mot de 10+ lettres = victoire).
- **Lettres** : Lettre précieuse, Collectionneur de lettres, Double contact, Triplé, Alphabet personnel, Pangramme.
- **Structure du mot** : Palindrome, Ouverture fermée, Voyelles en chaîne, Mur de consonnes, Mot crescendo, Mot propre.
- **Vocabulaire** : Vocabulaire varié, Lexicographe, Mémoire longue, Mot signature, Mot interdit, Famille de mots, Rime offensive, cartes par catégorie grammaticale (verbes, noms, adjectifs, pluriels).
- **Trajectoires et direction** : Contrepied, Ligne droite, Diagonale royale, Alternance, Insistance, Maître des trois voies.
- **Rebonds et balle** : Rebond profond/court, Effet latéral, Double rebond, Balle courbe, Balle lourde/plume, Balle de comète, Temps suspendu.
- **Table et cases** : Case chargée/fragile/miroir, Territoire, Teinture, Table conquise (victoire), Zone morte, Filet mouvant.
- **Raquette** : Raquette lourde/nerveuse, Sweet spot, Rotation chargée, Raquette mythique.
- **Manipulation de grille** : Lettre joker, Permutation, Réécriture, Réserve, Échange standard, Vol de lettre.
- **Risque et malédictions** : Vitesse incontrôlée, Voyelle/Consonne interdite, Table obscure, Dette lexicale, Tout ou rien, Mort subite, Contrat.
- **Construction** : Reroll, Bannissement, Copie, Amélioration, Sacrifice, Fusion de rareté, Collection (bonus de set), Carte jumelle, Mutation.

### Synergies types
- Mots longs + rotation de raquette + vitesse.
- Mots courts + validation immédiate + combos rapides.
- Lettres rares + renouvellement de grille + vocabulaire.
- Consonnes + balles lourdes + rebonds profonds ; voyelles + trajectoires souples.
- Répétition d'une direction + territoire + cases chargées.
- Mots sans correction + précision + conditions de victoire.
- Risque élevé + accélération permanente + mort subite.

### Conditions de victoire alternatives (légendaires)
Décalettres, Mot absolu, Alphabet complet, Sans correction, Grand chelem lexical, Table conquise, Mort subite, Keypong (réunir plusieurs familles).
