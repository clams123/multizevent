# Petit Multiview Twitch

Mini-projet autonome pour afficher 5 lecteurs Twitch sur une seule page.

- Lecteurs 1 et 2 : streamers choisis dans la liste.
- Lecteurs 3, 4 et 5 : tirage aleatoire toutes les 10 minutes depuis `public/channels.json`.
- Les lecteurs aleatoires excluent automatiquement les deux streamers deja choisis.
- Aucune cle Twitch n'est necessaire, car on n'appelle pas l'API Twitch.

## Lancer

```bash
node server.mjs
```

Puis ouvrir :

```text
http://localhost:3030
```

## Modifier la liste aleatoire

Editer `public/channels.json`, puis recopier la meme version dans `docs/channels.json` si vous publiez avec GitHub Pages :

```json
[
  "domingo",
  "ponce",
  "zerator"
]
```

## Port local

Editer `.env` :

```env
PORT=3030
```

## Deployer sur GitHub Pages

GitHub Pages doit publier le dossier `docs`.

1. Creer un nouveau repository GitHub.
2. Envoyer le contenu de ce projet dans le repository.
3. Sur GitHub, ouvrir `Settings`.
4. Aller dans `Pages`.
5. Dans `Build and deployment`, choisir `Deploy from a branch`.
6. Choisir la branche `main`.
7. Choisir le dossier `/docs`.
8. Cliquer sur `Save`.

L'URL sera du type :

```text
https://votre-pseudo.github.io/nom-du-repo/
```
