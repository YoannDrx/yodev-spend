# Quatre chantiers prioritaires — livraison locale du 7 septembre 2026

## Décision de mise en vente

**Pas de feu vert commercial à ce stade.** Les implémentations ci-dessous sont locales, sur `codex/production-audit-20260906`. Aucun déploiement applicatif ni paiement réel n’a été lancé. Les informations d’entreprise, le compte/sandbox Stripe et les identités de recette demandés au propriétaire ne sont pas encore fournis.

| Chantier | Livré | Preuves et limites |
|---|---|---|
| Recette staging | Commande de contrôle de configuration, matrice de recette, suite navigateur séparée avec Better Auth réel | Deux sessions synthétiques signées, isolation HTTP/export et révocation testées ; aucun consentement OAuth réel, invitation délivrée ou paiement sandbox validé. Preview manque de rôles DB séparés, Google, Resend et Stripe. |
| Données et finance | Suppression demandée par le propriétaire, révocation immédiate, trente jours d’export, annulation, purge atomique avec reçu ; correction immuable d’écritures/factures manuelles | PostgreSQL avec rôles réels, conflits concurrents, isolation entre espaces et parcours mobile ; identité partagée, conservation des pièces vendeur et expiration des sauvegardes sont des politiques séparées. |
| Exploitation | Reprise des traitements interrompus, verrou de cycle de vie, backoff et trois reprises par clé de synchronisation, commande de surveillance, répétition de restauration | Restauration de snapshot comparée sur 46 tables ; incident de routage rétabli, détaillé ci-dessous. Surveillance non encore raccordée à un canal d’alerte ; aucune validation de charge/RPO/RTO contractuel. |
| Commercial et juridique | Cinq brouillons FR/EN substantiels, identité/support configurables, version des textes, contrôle avant inscription publique et Checkout live | Texte non approuvé ; manque identité éditeur, support, fiscalité, contrats prestataires, garanties de transfert et conditions définitives. |

## Corrections qui protègent le cycle de vie

Les mutations vérifient de nouveau le droit d’écriture dans leur transaction. Les traitements fournisseurs détiennent un verrou exclusif que la suppression doit acquérir ; le récupérateur ne marque pas un worker vivant comme abandonné. Les traitements de workspaces sans droits commerciaux actifs sont refusés. Une reprise de scan ayant échoué conserve l’historique de l’échec et ne crée aucune preuve négative.

Les événements Stripe tardifs restent réconciliables dans les données commerciales sans rouvrir un workspace effacé ni recréer ses quotas. Les événements GitHub et la fin du parcours d’installation respectent la fermeture de l’espace. La purge du journal d’audit requiert la migration SQL 0012 ; si elle n’a pas réellement eu lieu, la transaction échoue et conserve les données pour reprise.

## Incident pendant la restauration

L’exercice a créé un snapshot puis sa copie restaurée. L’omission de `finalize:false` a entraîné une finalisation automatique et une permutation temporaire du compute de production entre 21:39:17 et 21:40:58 UTC le 6 septembre. J’ai rétabli l’endpoint sur sa branche d’origine, puis le nom `main` et le statut par défaut. Les 46 tables comparées étaient identiques. L’accueil et les tarifs ont ensuite répondu 200, et le tableau de bord a redirigé vers l’authentification en 307. Cette vérification ne prouve pas l’absence d’interruption transitoire. Le [rapport de restauration](RESTORATION_REHEARSAL_2026-09-06.md) précise la chronologie et la procédure corrigée.

## Éléments nécessaires à la clôture

1. Fournir l’identité juridique complète, téléphone professionnel, email de support et documents commerciaux déjà approuvés, s’il en existe.
2. Désigner le compte Stripe de Spend et son sandbox, les comptes GitHub/Google et les emails de recette ; configurer leurs secrets dans l’environnement prévu, sans les communiquer dans la conversation.
3. Finaliser les rôles et callbacks d’un staging isolé, puis exécuter la [matrice de recette réelle](STAGING_ACCEPTANCE.md).
4. Choisir la politique de conservation, les objectifs de reprise et le canal d’alertes ; vérifier la réception effective d’une alerte et la reprise sur une base isolée.
5. Finaliser et approuver le [dossier commercial](COMMERCIAL_LEGAL_DOSSIER.md), puis promouvoir une version dont la migration et les contrôles CI sont validés.

## Validation exécutée

- 134 tests dans 43 fichiers, aucun ignoré, contre PostgreSQL local avec les rôles applicatif et service séparés.
- 17 scénarios Playwright métier/accessibilité et un scénario à deux sessions Better Auth sans AUTH_TEST_MODE : 18 réussis. La demande/annulation de suppression et la correction financière mobile font partie de ces parcours.
- Lint, frontières d’accès DB, parité des 502 clés FR/EN, TypeScript et contrôle des rôles sur trente tables tenant passent.
- `check:operations` détecte les demandes de purge volontairement en retard dans les fixtures et renvoie 1. Cette preuve valide la remontée du signal, pas la réception d’une alerte externe.
- Capture de recette mobile conservée dans les artefacts locaux ; les vérifications navigateur utilisent Chromium. Les consentements OAuth, les emails réellement reçus, Stripe sandbox et les métriques de production restent non vérifiés.

Validation finale du lot : `npm run check` passe (lint, frontières DB, 502 clés FR/EN, TypeScript, 134 tests sans skip et build de 55 pages). Les 18 scénarios navigateur et le contrôle des rôles DB passent également. Aucun déploiement applicatif n’a été effectué.
