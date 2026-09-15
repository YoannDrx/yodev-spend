# Recette de staging — 7 septembre 2026

## État observé

Le projet Vercel Spend existe et le domaine public répond. L’environnement Preview contient les noms de variables GitHub OAuth/App ; les valeurs sensibles téléchargées sont masquées, donc aucune authentification GitHub réelle n’a été validée par ce téléchargement. Les variables `DATABASE_APP_URL`, `DATABASE_SERVICE_URL`, Google OAuth, Resend et Stripe sandbox manquent. La branche Neon historique `staging` est archivée et ancienne. Aucun nouveau déploiement n’a été lancé avec cette configuration incomplète.

Le contrôle répétable `npm run check:staging -- /chemin/vers/env-prive` ne modifie aucun service et n’affiche que des noms de variables et résultats. Il distingue une configuration masquée d’une authentification vérifiée. Conserver tout fichier d’environnement hors dépôt avec permissions 0600, puis l’effacer. Les variables de Preview ne doivent jamais être remplacées globalement par celles de production.

## Configuration de la recette

Créer un environnement isolé avec une base jetable, trois rôles dédiés, une App GitHub de test, des clients OAuth ayant leurs propres callbacks, un domaine expéditeur Resend vérifié et un sandbox Stripe. Déployer après migration SQL et passage de `check:db-security`. Désactiver `AUTH_TEST_MODE`, les fixtures de démonstration et la facturation live. Pour une URL de preview changeante, utiliser une URL de staging stable avant de fixer les callbacks OAuth.

Les deux suites locales ont des objets distincts : `test:e2e` valide les parcours métier sur des données synthétiques ; `test:e2e:auth` désactive `AUTH_TEST_MODE`, crée deux sessions signées vérifiées par Better Auth et teste leur isolation et révocation. Cela ne remplace pas le consentement OAuth chez un fournisseur.

## Parcours réels restant à signer

| Parcours | Attendu | Preuve à conserver sans secret |
|---|---|---|
| GitHub OAuth puis Google OAuth | Compte invité admis ; compte non invité refusé quand bêta fermée ; email cohérent | Compte de recette, date, résultat |
| Installation GitHub | État signé, consentement, sélection d’un dépôt privé de test, scan explicable | Installation de test, résultat et scope |
| Révocation GitHub | Dépôt retiré ou App suspendue ; accès effectivement arrêté | État avant/après et webhook |
| Invitation à un second compte | Réception, acceptation, bon rôle/espace ; lien expiré et compte différent refusés | Identifiants de test et résultat, sans token |
| Connecteur fournisseur | Validation des permissions ; période fermée rapprochée avec une facture du compte de test | Nombre de lignes, devise, écart expliqué |
| Stripe sandbox | Essai, premier paiement, changement d’offre, impayé, résiliation, doublon et retard de webhook | IDs sandbox, statuts et droits obtenus |
| Suppression | Demande, secrets révoqués, export, annulation, seconde demande, purge accélérée uniquement dans la base jetable | Receipt, tables restantes et isolation |
| Support et opérations | Message reçu au canal choisi, alerte de cron arrêté et sauvegarde restaurée | Ticket de test et rapport de restauration |

Ne pas utiliser de vraie carte bancaire ou de compte fournisseur client pour cette recette. La validation live éventuelle est une étape distincte du sandbox et doit porter sur un compte Stripe explicitement choisi.
