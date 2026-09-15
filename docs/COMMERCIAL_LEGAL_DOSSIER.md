# Dossier commercial à finaliser — version 2026-09-06

Les cinq pages FR/EN contiennent maintenant un projet de mentions légales, confidentialité, conditions, accord de traitement et liste de prestataires, fondé sur le fonctionnement audité. **Ce sont des brouillons, pas des contrats approuvés.** Le contenu éditorial est dans `src/server/commercial/legal-copy.ts`, l’identité vient des variables documentées dans `.env.example`.

## Informations encore nécessaires

- Raison sociale ou nom de l’entrepreneur, forme juridique, numéro d’immatriculation, adresse professionnelle, directeur de publication, téléphone professionnel, email de support et numéro de TVA le cas échéant.
- Entité Stripe qui facture Spend, régime de TVA, facturation des clients étrangers, prix HT/TTC et traitement de l’essai et des remboursements.
- Conditions d’assistance (jours/heures, délais cibles), droit applicable, règlement des litiges, responsabilité et éventuelle assurance.
- Registre des traitements : base légale, durée par catégorie, responsable, demandes des personnes et suppression de l’identité quand elle n’est plus utilisée ailleurs.
- Contrats Vercel/Neon/GitHub/Google/Stripe/Resend effectivement souscrits, entités légales, lieux de traitement, garanties de transfert et procédure de changement de sous-traitant.
- Politique des sauvegardes et journaux, responsables des alertes et incidents, calendrier de suppression des pièces commerciales conservées.

## Comportements actuellement matérialisés

Les nouvelles écritures financières corrigent par remplacement, sans effacer l’original. Le propriétaire demande séparément la suppression métier après résiliation ; l’application révoque ses accès stockés, rend l’espace non modifiable, ferme l’export après trente jours et effectue une purge transactionnelle. Une annulation pendant le délai rétablit l’état privé ou résilié, sans restaurer les secrets. Les identités communes et pièces commerciales de l’éditeur sont séparées de la purge métier. Une purge ne prouve pas l’effacement immédiat des sauvegardes externes.

La région Vercel observée est `iad1` et Neon `aws-us-east-1`. L’historique Neon observé est de six heures. Ne pas annoncer une résidence exclusivement européenne, un RPO/RTO ou un SLA non mesuré.

## Publication

1. Renseigner l’identité et le support dans l’environnement de staging.
2. Finaliser les clauses provisoires de `legal-copy.ts` et obtenir la validation adaptée au statut de l’entreprise, notamment fiscale et contractuelle.
3. Vérifier les cinq pages dans les deux langues et faire correspondre le texte au contrat effectivement souscrit chez chaque prestataire.
4. Définir `LEGAL_APPROVED_VERSION=2026-09-06` uniquement après cette revue. Toute révision de contenu contractuel doit incrémenter `legalDocumentVersion` et demander une nouvelle validation.
5. Le code refuse les nouveaux Checkout utilisant une clé Stripe live si l’identité, un email de support utilisable ou l’approbation de cette version manquent. Le portail de résiliation et les webhooks restent disponibles. L’inscription commerciale publique en production exige aussi cette validation.

## Références de préparation

Les mentions d’un site professionnel doivent permettre d’identifier et contacter l’éditeur : [Service Public — commerce en ligne](https://entreprendre.service-public.gouv.fr/vosdroits/F23455) et [Ministère de l’Économie — mentions obligatoires](https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/mentions-sur-votre-site-internet-les-obligations-respecter).

Le contrat de sous-traitance doit préciser les instructions et obligations des parties, dont assistance, sécurité, restitution/effacement et audit : [CNIL — article 28](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4) et [CNIL — clauses contractuelles](https://www.cnil.fr/fr/clauses-contractuelles-types-entre-responsable-de-traitement-et-sous-traitant). Le dossier ne déduit pas de ces références que Spend serait déjà conforme ou que ses garanties de transfert sont validées.
