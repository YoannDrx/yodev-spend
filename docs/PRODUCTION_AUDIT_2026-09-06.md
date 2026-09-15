# Audit produit et préparation commerciale — 6 septembre 2026

## Verdict

**La base produit est substantielle, mais une ouverture commerciale générale ne peut pas être déclarée prête.** Cet audit apporte des correctifs et des parcours vérifiés localement. La validation OAuth/provider réelle, le cycle Stripe de staging, le traitement des suppressions, la reprise sur incident et les documents contractuels restent des conditions de lancement.

Un test passant ne prouve que le scénario couvert. Les tests avec PostgreSQL exécutent les rôles `spend_app`, `spend_service` et `spend_migration`. Les tests navigateur utilisent une authentification locale de test et des données PostgreSQL ; ils ne simulent plus l'intégralité du produit avec des chiffres de démonstration. Aucun paiement ni changement d'infrastructure de production n'a été exécuté pendant cet audit.

## Périmètre et production constatée

- Base auditée : `2e5fa64`, fusion de la fondation commerciale ; branche de correction : `codex/production-audit-20260906`.
- Vercel confirme que `spend.yodev.fr` pointe sur le déploiement `dpl_4NGKKZC5uwUkAW7gPi6UvfiursJ8`, prêt, construit depuis ce même commit.
- Région d'exécution constatée : **`iad1`**, États-Unis. Ne pas présenter l'hébergement comme exclusivement européen. Une migration de région/base exige une répétition de sauvegarde/restauration et un plan de bascule.
- Les pages publiques commerciales sont déjà déployées. Les sections historiques du plan commercial qui affirmaient le contraire sont périmées.
- Le schéma, les secrets, les droits et les données de la base de production n'ont pas été modifiés ni certifiés. Les changements de cet audit restent locaux jusqu'à une promotion vérifiée.

## État des fonctionnalités

| Fonctionnalité | Ce qui existe / validation obtenue | Ce qui empêche une certification complète |
|---|---|---|
| Authentification GitHub / Google | Better Auth, sessions, liaison explicite des identités ; tests des frontières d'autorisation ; admission des collaborateurs corrigée | OAuth réel, liaison/déliaison et révocation des sessions à valider en staging ; Google dépend de sa configuration |
| Workspaces et isolation | Transactions tenant, RLS, trois rôles distincts ; contraintes et isolation testées avec PostgreSQL ; garde runtime production renforcée | Exécuter le contrôle des rôles sur staging puis production ; tester toutes les mutations avec deux vrais comptes |
| Membres et invitations | Invitation, acceptation, annulation, modification de rôle et retrait ; accès à l'inscription par invitation d'équipe corrigé | Livraison Resend réelle, concurrence des invitations et acceptations/quota, changement d'espace et transfert de propriété à terminer/valider |
| Clients / projets | Création, édition, archive/restauration, recherche, filtre de statut et pagination d'affichage ; parcours navigateur avec base réelle | Pas de gestion autonome complète des dépôts manuels ; restauration des dépôts nécessite une réimportation explicite |
| GitHub App | État temporaire, PKCE, installation vérifiée, import par métadonnées canoniques ; webhooks de retrait et suspension corrigés | Refaire installation/import/scan/retrait sur une organisation de staging réelle ; traiter l'ensemble des événements retardés |
| Scanner | Détection déterministe, fixtures, nettoyage des secrets, scans quick/deep, preuve et protection contre l'absence sur scan partiel | Reprise des exécutions bloquées, suivi des erreurs avant création du scan, capacité du planificateur sous charge et latence API |
| Découvertes | Confirmation, exclusion et historique d'événements ; inbox paginée indépendante des six aperçus du dashboard ; filtres par décision | Preuves actuellement bornées ; ajouter une vue exhaustive du dernier scan et un meilleur historique des changements |
| Dépenses manuelles | Comptes, abonnements, coûts/crédits, devises, allocations ; saisie décimale exacte ; historique des 100 dernières écritures | Révisions/corrections financières guidées et historique intégral paginé à compléter |
| Factures | Totaux manuels, déduplication concurrente, supersession conservant l'historique ; refus des chevauchements ambigus | Centre de résolution des conflits et corrections de factures ; import documentaire/OCR absent |
| Reporting financier | Allocations datées, conversions ECB, précision bigint, avertissement devise manquante, source/date des taux | Définir et valider la clôture mensuelle, les coûts couvrant plusieurs périodes et le rapprochement avec les factures réelles de chaque fournisseur |
| Connecteurs Vercel / OpenAI / GitHub Billing / AWS | Adaptateurs et fixtures, accès en lecture, chiffrement des identifiants, synchronisation et états partiels | Réconciliation réelle d'une période fermée par fournisseur ; rotation des secrets, reprise durable et charges représentatives ; GitHub Billing reste en preview |
| Recommandations / alertes | Règles déterministes, examen des recommandations, résolution/ignorance des alertes | Catalogue de plans vérifiés, complétude des usages et test des recommandations sur comptes réels ; ne pas promettre une économie garantie |
| Stripe SaaS | Checkout, portail, webhooks signés, essais, statuts et quotas ; changement d'offre Portal et concurrence des événements corrigés | Cycle sandbox réel complet, Checkout abandonné/repris, prorata/annulation, configuration des prix et du portail, activation live contrôlée |
| Export | Export JSON métier propriétaire uniquement, valeurs exactes, champs explicitement sélectionnés, `no-store` | Limite volontaire de 10 000 lignes par collection avec refus explicite ; export asynchrone pour gros volumes, export complet de portabilité et CSV/PDF à concevoir |
| Confidentialité / fin de vie | Tables de jobs et plan de rétention existants | Demande utilisateur, délai d'annulation, purge effective, rétention légale et preuves d'exécution absents ; blocage avant vente |
| UI/UX FR/EN | Navigation active, navigation mobile lisible, focus clavier, erreurs/chargement/404, saisies préservées en erreur, états d'enregistrement, historique et recherche | Tests utilisateurs réels, lecteurs d'écran, Safari/iOS et performance sous charge ; pas de revendication WCAG exhaustive |
| Site commercial | Landing, fonctionnalités, tarifs, sécurité, brouillons juridiques | Identité légale, contacts, CGV/DPA/confidentialité contractuels et situation TVA à valider ; certaines promesses de disponibilité ont été rendues prudentes |

## Défauts corrigés pendant l'audit

1. **Données fictives hors démonstration** : l'absence de `DATABASE_URL` déclenchait les fixtures, y compris avec une vraie `DATABASE_APP_URL`. Les queries réelles passent maintenant obligatoirement par PostgreSQL. `DEMO_DATA_ENABLED` est explicite, réservé au mode local, et interdit en production.
2. **Devises mal affichées** : division systématique par 100 et conversion en `Number`. L'affichage et la saisie respectent désormais la précision de la devise et les grands entiers.
3. **Facture et chevauchement partiel** : un total pouvait supprimer un coût couvrant une période plus longue. Les cas ambigus sont refusés ; les écritures existantes restent intactes.
4. **Facture saisie deux fois avec un montant différent** : l'ancienne identité incluait le montant. Un verrou de compte et une vérification du numéro/contenu empêchent la duplication et les conflits silencieux.
5. **Coûts réimportés après clôture** : les nouvelles lignes d'une sync sont rapprochées des factures existantes dans la même transaction. Une facture déjà présente ne perd plus sa priorité sur une nouvelle ligne de coût couverte.
6. **Conflit avec un montant final manuel** : la facture ne s'ajoute pas silencieusement à une écriture finale qui couvre la même période. Un message indique qu'un examen est nécessaire.
7. **Engagements de connecteur renouvelés** : l'upsert actualise le statut, le modèle et les dates, permettant la réactivation d'un engagement précédemment expiré.
8. **Gaspillage sur une simple alerte de renouvellement** : les alertes sans lien explicite avec un compte non attribué ne contribuent plus automatiquement au gaspillage potentiel.
9. **Couverture artificielle à 100 % sur une base vide** : affichage d'un état sans dépense plutôt qu'un score fabriqué.
10. **Frontière de mois** : les coûts dont la borne de fin exclusive est le début du mois suivant ne sont plus comptés dans les deux mois.
11. **Modification de projet réactivant les scans** : les changements de nom/description ne touchent plus les dépôts désactivés. Une restauration respecte les quotas et exige un client actif.
12. **Import GitHub faisant confiance aux champs du navigateur** : les informations sont récupérées dans la liste effectivement accessible à l'installation.
13. **Webhooks GitHub trop permissifs** : les événements sans rapport sont ignorés ; l'état de l'installation est relu auprès de GitHub ; les dépôts retirés sont archivés sans effacer l'historique.
14. **Inscription des collaborateurs bloquée** : une invitation d'équipe valide permet la création de l'identité sans seconde invitation bêta ; elle n'accorde pas la membership avant acceptation.
15. **Changement d'offre Stripe rejeté** : le tarif du webhook, validé contre les prix autorisés, détermine l'offre et la périodicité. Les anciennes métadonnées de Checkout ne bloquent plus les changements du portail. Les écritures concurrentes sont sérialisées et la liaison workspace/client est vérifiée.
16. **Configuration production ambiguë** : les connexions runtime exigent leurs identités dédiées. La clé de migration n'est pas requise dans le runtime commercial. Un script indépendant contrôle les attributs des rôles, RLS et accès non scopés.
17. **Tests navigateur fictifs** : l'authentification de test et les données de démonstration sont séparées ; les parcours de recette créent des records réels dans une base locale jetable.
18. **Utilisabilité** : labels reliés aux champs, thème sans différence SSR/client, navigation active/mobile, déconnexion, lien d'alertes fonctionnel, erreurs récupérables, filtres et historique ajoutés.
19. **Ajout manuel après clôture** : une nouvelle écriture sur une période déjà facturée est refusée sous le même verrou que le rapprochement. Une correction guidée reste à construire ; les périodes suivantes restent ouvertes. Les changements d'allocation d'un même compte sont également sérialisés.

## Vérification reproductible

Points d'entrée du code corrigé et de sa validation :

| Domaine | Implémentation | Preuve automatisée |
|---|---|---|
| Montants / devises | `src/lib/money.ts` | `src/lib/money.test.ts` |
| Rapprochement / clôture | `src/server/billing/reconciliation.ts`, `src/server/connectors/sync.ts` | `src/server/billing/reconciliation.integration.test.ts` |
| Admission des invitations | `src/server/auth/registration.ts` | `src/server/auth/registration.integration.test.ts` |
| Événements Stripe | `src/server/commercial/stripe-webhook.ts` | `src/server/commercial/stripe-webhook.integration.test.ts` |
| Événements GitHub | `src/server/github/webhook.ts` | `src/server/github/webhook.integration.test.ts` |
| Rôles DB / export | `src/db/configuration.ts`, `scripts/check-db-security.mjs`, `src/server/exports/workspace.ts` | Tests de configuration, export et isolation PostgreSQL dans `src/` |
| UI et vrais parcours | `src/components/action-form.tsx`, `src/components/app-navigation.tsx`, `src/components/list-toolbar.tsx` | `e2e/readiness.spec.ts`, `e2e/smoke.spec.ts` |

Utiliser une base **jetable** et les variables des trois rôles, jamais une base client. Provisionner, migrer, reprovisionner les droits, bootstrapper puis semer la fixture locale.

```bash
npm ci
npm run db:provision-roles
npm run db:migrate
npm run db:provision-roles
npm run db:bootstrap
npm run db:seed
npm run check:db-security
npm run check
npm run test:e2e
npm audit --audit-level=high
```

`TEST_DATABASE_URL` est obligatoire pour la validation de release et désormais exigée par Vitest en CI. La vérification de sécurité utilise `DATABASE_APP_URL` et `DATABASE_SERVICE_URL` et ne journalise pas les chaînes de connexion. Elle complète les tests RLS, sans prétendre tester chaque mutation HTTP de production.

Les tests E2E utilisent `AUTH_TEST_MODE=true`, `DEMO_DATA_ENABLED=false`, un port isolé et un seul worker. Ils couvrent création/recherche/archive/restauration, saisie invalide et conservation des champs, montants décimaux, conflit de facture, export, navigation mobile, thèmes, erreurs de lien et analyse axe WCAG A/AA sur les formulaires principaux en FR/EN. Ils ne couvrent pas un paiement réel, un consentement OAuth ni les API fournisseurs en ligne.

La base PostgreSQL 16 locale a été initialisée vide et les migrations existantes `0000`–`0010` ont été appliquées. Aucun nouveau schéma ni aucune migration destructive n'est nécessaire pour ce lot.

Résultats de la passe finale locale : lint, frontières DB, parité FR/EN (**465 clés par langue**) et TypeScript passent ; **122 tests passent dans 39 fichiers**, sans tests ignorés. `npm audit --audit-level=high` rapporte **0 vulnérabilité**. Les tests utilisent une base dédiée, distincte de toute base de production.

Le build Next.js de production passe, avec **53 pages générées**. `check:db-security` valide les identités, attributs, RLS et droits des deux rôles runtime sur **30 tables tenant**. La compilation et la génération de types sont exécutées séparément du serveur de développement pour éviter les écritures concurrentes dans `.next`.

La dernière exécution complète Playwright passe : **15 tests sur 15, en 1,1 minute**, dont six analyses axe distinctes (clients, dépenses et connexions en FR/EN). Les premières exécutions avaient rencontré des délais de compilation, des artefacts `.next/dev` invalides et un sélecteur de test trop strict pour le menu de statut. Les artefacts ont été régénérés, les contrôles axe séparés par page et le sélecteur remplacé par le rôle accessible du champ. Le parcours ciblé puis la suite complète ont été rejoués avec succès. Ces temps de développement ne constituent pas une mesure de performance de production.

## Avant toute promotion de ce lot

- Installer `DATABASE_APP_URL` et `DATABASE_SERVICE_URL` avec les rôles exacts attendus ; exécuter `check:db-security` en staging puis en production depuis l'environnement opérateur.
- Garder `AUTH_TEST_MODE=false` et `DEMO_DATA_ENABLED=false` sur les déploiements. Retirer les credentials opérateur/migration des Functions ; la migration reste un job distinct.
- Vérifier les parcours privés existants dans une preview connectée à une base de staging isolée. Les changements de garde runtime font volontairement échouer une configuration dangereuse.
- Rejouer GitHub, invitations et Stripe avec les vrais comptes de staging et conserver des preuves sans secrets.
- Revoir le diff, faire passer la CI distante sur la branche, puis promouvoir le déploiement après validation des prérequis.

## Priorité produit recommandée

**Avant bêta payante** : cycle d'abonnement réel, invitation et email de bout en bout, traitement de suppression/annulation, réconciliation de périodes réelles, gestion des erreurs persistantes de synchronisation, documents contractuels finalisés, support joignable, sauvegarde/restauration répétée.

**Après stabilisation de ce noyau** : centre de réconciliation et correction des écritures, vue de clôture mensuelle, changement de workspace, exports volumineux/CSV, budgets et alertes de dépassement.

**Extensions optionnelles** : Gmail/OCR, connecteur Neon financier, imports bancaires et rapports PDF. Ils ne sont pas nécessaires pour vendre un premier périmètre limité, à condition de ne pas les annoncer comme disponibles. Gmail introduit des validations externes propres ; ne pas en faire une dépendance du premier lancement si l'import manuel couvre le besoin validé.

La bêta et les exercices de restauration prennent du temps réel. Ils ne peuvent pas être remplacés par un pourcentage de confiance, une compilation réussie ou un drapeau de fonctionnalité activé.
