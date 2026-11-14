# Keypong — proposition de mécanique de jeu

Proposition complète pour le cœur du jeu. Elle répond aux deux problèmes notés dans `IDEAS.md` (le Z trop fort, les six lettres adverses pas assez contraignantes) et prépare le multijoueur.

Deux propositions : **A (recommandée)** et **B (alternative)**. Chacune est découpée en lots qu'on peut livrer et tester un par un.

## Le pitch (format reel, 15 secondes)

> **Scrabble × ping-pong. Tape plus vite que la balle.**
>
> 1. La balle arrive sur une lettre : **ton mot commence par elle**.
> 2. **La dernière lettre de ton mot choisit où tu renvoies la balle.**
> 3. Plus ton mot vaut de points, **plus la balle va vite**.
> 4. Tu as deviné le mot adverse ? Réponds avant le rebond : **VOLÉE !**

Storyboard possible :

| Plan | À l'écran | Texte |
| --- | --- | --- |
| 1 | La balle arrive sur le T, les tuiles T-A-B-L-E apparaissent | « Ton mot commence par la lettre où arrive la balle » |
| 2 | Le E s'allume en face, la balle y part | « Sa dernière lettre choisit où tu renvoies » |
| 3 | Un mot avec un W, la balle fuse, le sablier se vide | « Gros mot = balle rapide » |
| 4 | L'adversaire tape encore, le joueur a déjà son mot prêt, frappe sans rebond | « Devine son mot. VOLÉE ! » |
| 5 | Balle ratée, écran de victoire | « Keypong. À tester. » |

---

## Proposition A — « Première et dernière lettre » (recommandée)

### Lot A1 — Le cœur (3 règles)

1. **Départ imposé.** Ton mot commence par la lettre de ta table où la balle est arrivée. Au service, tu choisis librement parmi tes six lettres.
2. **Tu vises avec la dernière lettre.** Ton mot doit *finir* par une des six lettres adverses. La balle part sur cette lettre : c'est par elle que l'adversaire devra commencer.
3. **Points = vitesse.** La valeur Scrabble du mot fixe le temps de réponse adverse (formule actuelle, inchangée). Balle non renvoyée à temps = point perdu.

Règles annexes, toutes simples :

- **Pas d'ace.** Le service est sans chrono pour le serveur, donc il vaut toujours un mot moyen (3,5 s pour répondre), quel que soit le mot. Sinon le serveur prépare tranquillement un mot énorme.
- **La lettre jouée est remplacée** (déjà le cas) : la lettre de départ du frappeur change après son coup.
- **Pas deux fois le même mot** dans un échange.
- **Le X sort du tirage de la table** (voir équilibrage). Il reste jouable à l'intérieur des mots.
- **Match en 5 points.** Le perdant du point sert le suivant (petit avantage : pas de chrono, départ libre).

Ce que ça change par rapport à aujourd'hui : une seule règle, « contenir une lettre adverse » devient « finir par une lettre adverse ».

### Pourquoi ça règle les deux problèmes

Chiffres mesurés sur le dictionnaire du jeu (mots de 2 à 8 lettres, 20 000 tables tirées au hasard) :

| | Règle actuelle (contenir) | Règle A (finir par) |
| --- | --- | --- |
| Part des mots commençant par ta lettre qui sont jouables | 94,5 % | 43,6 % |
| Situations sans aucun mot jouable | — | 0,01 % |
| Nombre médian de mots jouables | — | ~2 000 |

- **Contrainte.** Aujourd'hui presque tout est jouable (94,5 %) : la règle ne contraint rien. Avec A, plus de la moitié des mots sont exclus, mais on n'est quasiment jamais bloqué.
- **Le Z.** Les formes en « -EZ » représentent 9,5 % du dictionnaire et valent en moyenne 23,8 points contre 11,5 pour un mot normal. Avec A, un mot en « -EZ » n'est jouable que si le Z est sur la table adverse (environ 2 % des tables). Ça devient un jackpot rare au lieu d'une astuce permanente.

### La profondeur qui apparaît sans règle en plus

- **Viser la lettre faible.** Finir par S, E ou T est facile (deux tiers des mots finissent ainsi), mais ça offre un départ facile à l'adversaire. Finir par U, N, O ou I est plus dur à trouver, et l'adversaire aura beaucoup moins de mots pour repartir (U : 0,5 % des mots, contre 9,9 % pour C). Jeu de base : renvoyer. Jeu avancé : choisir où ça fait mal.
- **Ta table est ta défense.** Une lettre rare chez toi (K, W, Y, Z) est une cible : l'adversaire gagne à te l'envoyer. Une fois que tu as joué depuis elle, elle est remplacée.
- **Mot long ou mot rapide.** Un mot long rapporte plus, mais se tape sur ton propre chrono.

### Lot A2 — Anticipation : la volée et la feinte

Demande deux claviers, donc à livrer avec le multijoueur (la volée seule est testable dès maintenant).

- **Le mot adverse s'écrit sous tes yeux**, tuile par tuile, et la lettre visée s'allume sur ta table en direct.
- **Tu peux taper ton mot pendant que l'adversaire tape le sien.** Si tu devines sa dernière lettre, ta réponse est prête quand la balle part.
- **Volée.** Si tu renvoies avant le rebond de la balle, ton coup vaut ×1,5. C'est la récompense de l'anticipation.
- **Feinte.** L'adversaire voit aussi ce que tu prépares. Il tape « MAISON » (le N s'allume chez toi, tu prépares un mot en N), puis ajoute un S au dernier moment : la balle part sur le S. Si ton mot préparé ne commence pas par la bonne lettre, il est effacé.

Aucune règle de bluff à expliquer : elle découle du fait que chacun voit les tuiles de l'autre.

### Lot A3 — Variété (plus tard)

- **Smash et amorti avec un vrai effet** (aujourd'hui ce sont seulement des textes). Smash, 8 lettres ou plus : impossible à reprendre de volée. Amorti, 2 ou 3 lettres : balle lente, mais la lettre visée n'est révélée qu'au rebond.
- **Cartes roguelike** : voir `IDEAS.md`. À ne lancer qu'une fois A1 et A2 validés.

### Équilibrage et points à surveiller

| Risque | Mesure | Réponse proposée |
| --- | --- | --- |
| X chez soi = point perdu | 899 mots finissent par X (-EUX, -AUX), 45 seulement commencent par X | Retirer le X du tirage de la table |
| Z chez soi | 7 537 mots finissent par Z, 685 commencent par Z | Laisser : c'est jouable (ZÉRO, ZONE, ZOO) et rare |
| W, Y, K, Q, J chez soi | Entre 140 (W) et 1 309 (J) mots de départ | Laisser : difficiles mais jouables |
| S adverse = pluriel systématique | 32,8 % des mots finissent par S | Laisser : départ facile offert à l'adversaire, et la lettre est remplacée après usage |
| Service trop fort | Pas de chrono au service | Service à vitesse fixe (pas d'ace) |
| Volée trop forte | À tester | Ajuster le ×1,5 (entre ×1,25 et ×2) |

Valeurs de départ à ajuster en jouant : temps au service 3,5 s, volée ×1,5, match en 5 points.

---

## Proposition B — « Allume la table » (alternative)

Garde la règle actuelle (contenir) et change ce qui rapporte.

### Lot B1 — Le cœur

1. Ton mot commence par la lettre où la balle est arrivée (inchangé).
2. **Seules les lettres de la table adverse rapportent.** Chaque lettre adverse présente dans ton mot s'allume et ajoute ses points. Les autres lettres ne valent rien.
3. La balle part sur la **dernière lettre allumée**.

### Lot B2 — Combo

- Allumer 3 lettres adverses ou plus dans un même mot : coup ×1,5. Les six : ×3.

### Comparaison avec A

| | A — Première et dernière | B — Allume la table |
| --- | --- | --- |
| Explication en une phrase | « Commence par ta lettre, finis par une des siennes » | « Touche un maximum de lettres d'en face » |
| Contrainte sur le mot | Forte et nette (43,6 % des mots) | Faible (un mot passe presque toujours, mais vaut peu) |
| Z trop fort | Réglé (jouable sur 2 % des tables) | Réglé (ne compte que s'il est sur la table) |
| Contrôle de la cible | Total et lisible | Moyen |
| Anticipation du mot adverse | Naturelle (deviner la dernière lettre) | Faible (la cible dépend de tout le mot) |
| Lisibilité pour un spectateur | Très bonne | Bonne (les cases s'allument) |
| Lien avec les tuiles Scrabble | Direct (valeurs Scrabble) | Indirect (valeurs partielles) |

**Recommandation : A.** Elle tient en trois règles, se comprend en regardant un seul échange, et l'anticipation en découle sans mécanique ajoutée. B est plus permissive et plus « puzzle » ; son système de points peut resservir plus tard comme carte ou comme mode alternatif.

---

## Ordre de réalisation conseillé

1. **A1** : changer la règle de visée, service à vitesse fixe, X hors tirage, match en 5 points. Testable seul, contre soi-même.
2. **Volée** (partie de A2) : bonus si on renvoie avant le rebond. Testable seul.
3. **Multijoueur**, puis le reste de **A2** (saisie simultanée, tuiles adverses en direct, feinte).
4. **A3**, puis les cartes.
