# La Caisse du marché

Petite application web installable conçue pour encaisser rapidement au marché. Les produits (photo, nom et prix indicatif) sont enregistrés dans le stockage local du navigateur. Pour fonctionner hors ligne et être installée, ouvrez-la depuis une adresse HTTPS ou depuis localhost.

## Utilisation

1. Appuyer sur « Étal » et ajouter les références. « Terminer » revient à la caisse.
2. Choisir un produit, lire le montant calculé par la balance, puis le saisir. Le montant est arrondi au multiple de 10 centimes le plus proche.
3. Ajouter les lignes au panier. Ajuster leur quantité ou les supprimer.
4. Saisir le montant remis par le client et calculer la monnaie. L’application présente une combinaison avec le moins de pièces possible.

La monnaie est rendue en pièces de 2 €, 1 €, 50 c, 20 c, 10 c, 5 c, 2 c et 1 c. Chaque vente reste temporaire en mémoire et s’efface au rechargement.

## Publications

Chaque révision publiée reçoit un dossier d’URL distinct, `caisse-marche-<empreinte-du-contenu>`, et un cache PWA qui lui est propre. Les anciennes révisions restent en place pour que leurs liens ne soient pas remplacés. L’adresse exacte de chaque publication est affichée dans les journaux de l’action GitHub « Publish public apps ».


## Plusieurs étals

Les produits et photos existants sont repris automatiquement dans « Mon étal » à la première ouverture de cette version. Dans le bouton « Étal », tu peux enregistrer ou renommer l’étal actif, en créer un autre et charger un étal déjà enregistré. Les étals sont conservés sur ce téléphone et restent disponibles lorsque l’application change de version.


Dans « Étal », les boutons d’export et d’import permettent de garder une copie JSON de tous les étals et de leurs photos, ou de la restaurer sur ce téléphone. Sur téléphone, le partage du fichier permet de choisir une destination disponible dans le menu système.
