# Exercice de restauration — 6 septembre 2026

## Résultat et incident

Le snapshot Neon `snap-late-fog-aw9egst6` a été créé depuis `br-cold-smoke-awud6nl9`, LSN `0/30D9E00`. La restauration a été vérifiée en comparant le nombre de lignes et une empreinte déterministe de chaque table : **46 tables identiques**, sans extraire les données ni les secrets. Le schéma contient 46 tables publiques, un workspace, un client, un projet et aucune écriture de coût à cet instant.

**L'exercice n'a pas été entièrement isolé.** L'appel `restore_snapshot` avec un nom neuf et sans `target_branch_id`, mais sans `finalize:false`, a automatiquement finalisé la restauration : permutation de la branche par défaut et déplacement du compute de production. Cette sémantique a été identifiée immédiatement après l'appel. Aucune écriture métier volontaire n'a été exécutée sur la restauration.

- 21:39:17 UTC : restauration et finalisation automatique.
- Comparaison en lecture seule des 46 tables : aucune différence entre original et restauration.
- 21:40:58 UTC : endpoint original `ep-round-cherry-awn6bjxl` réaffecté à `br-cold-smoke-awud6nl9`.
- 21:41:03 UTC : nom `main` et statut de branche par défaut rétablis sur la branche d'origine.
- La copie restaurée `br-bold-frost-aw23x9bd` est isolée et expire le 8 septembre 2026 ; la branche de répétition `br-wandering-wildflower-aw5uga5k` a la même échéance.

Le déplacement de compute implique un redémarrage ; une interruption transitoire des connexions était possible. L'absence de différences observées ne constitue pas une preuve de disponibilité continue. Aucun ancien enregistrement n'a été effacé. Le snapshot temporaire expire le 8 septembre 2026.

## Procédure corrigée

1. Relever branche par défaut, IDs et affectations des endpoints avant toute opération.
2. Créer un snapshot avec échéance ; ne pas modifier l'origine.
3. Passer **explicitement `finalize:false`** à `restore_snapshot`, même pour une copie portant un nouveau nom.
4. Vérifier immédiatement que la branche par défaut et l'endpoint de production n'ont pas changé.
5. Attacher un compute distinct à la copie si nécessaire et comparer schéma, comptages et empreintes.
6. Ne jamais appeler `finalize_branch_restore` lors d'un exercice. La promotion est une opération séparée, préparée et explicitement autorisée.
7. Expirer les copies et les snapshots de répétition, qui contiennent des données réelles.

## Limites constatées

Le projet utilise PostgreSQL 18 en `aws-us-east-1` et ne retient que six heures d'historique. Le contrôle précédent sur PostgreSQL 16 local ne valide donc pas à lui seul toute la compatibilité d'exploitation. Les snapshots automatiques, l'alerte de fraîcheur des sauvegardes et un RPO/RTO contractuel doivent encore être configurés et approuvés. Cet exercice prouve qu'une restauration de snapshot est lisible et identique au point sauvegardé ; il ne constitue pas une certification de reprise globale.
