import type { TexteEngagementEntree } from '../contracts';

/**
 * Texte d'engagement malgache de référence, recopié EXACTEMENT depuis
 * `docs/texte-engagement-malgache.md` (lignes 60 à 82 du PDF `fiche-adhesion-
 * musique.txt`), SANS correction, traduction ni reformulation. Les passages
 * mal extraits (coupures de ligne, espaces multiples, orthographe inhabituelle
 * comme « sonia » ou « rejisitry ») sont laissés tels quels, conformément à la
 * consigne.
 *
 * 3 blancs (séquences de points de suspension) sont remplacés par des
 * variables servies par le service, via `rendreTexteEngagement()` :
 *
 * | Placeholder        | Emplacement dans le texte source                                              | Variable                     |
 * |--------------------|-------------------------------------------------------------------------------|------------------------------|
 * | `{{nom_prenoms}}`  | « Izaho …… » (ligne 1 du bloc)                                                 | `nom_prenoms` du candidat    |
 * | `{{categorie}}`    | « ao amin'ny antokon'ny ……… » (ligne 5)                                       | libellé de la catégorie      |
 * | `{{date_du_jour}}` | « Natao teto Antananarivo, anio faha…………………… » (dernière ligne)                 | date du jour JJ/MM/AAAA      |
 *
 * La ville « Antananarivo » reste EN DUR (donnée du texte de référence) : le
 * « lieu de l'engagement » saisi sur l'écran Engagement est stocké séparément
 * pour le PDF et la base, jamais réinjecté dans ce texte.
 */
export const TEXTE_ENGAGEMENT_MALGACHE_TEMPLATE = `Izaho {{nom_prenoms}}
……………………izay   manao   sonia   eto
ambany.
Araka ny dikam-panjakana manangana ny « Office Malagasy du Droit d'Auteur » OMDA.
Araka ny fanekena ny filatsahako ao amin'ny antokon'ny {{categorie}}
………
Dia manamafy ny fankatoavako tsy misy fepetra ny fitsipi-pifehezana voalaza
amin'ny Fimasoana ny Zon'ny Mpamorona eto Madagasikara. (Office Malagasy du Droit
d'Auteur na ny OMDA).

Ary atolotro azy tanteraka sy ho an'ny firenena rehetra ny zo hanome alalana sy
handrara ny fanontana, na amin'ny endrika inona na amin'ny inona ny fampitana ho an'ny
besinimaro sy fandikana na fandrindrana ny sanganasako ankehitriny sy izay mbola ho
avy, na mikasika ny haisoratra izany na siansa, na ny hira izay mety ho sokajin-javakanto
isaloran'ny famoronana ara-tsaina.

Raha misy fanaovana na inona na inona karazany, na fototra iaviany, dia mandray
ny zon'ny mpamorona aterak'izany koa ny « Office Malagasy du Droit d'Auteur » OMDA.
Mijanona ho fananan'ny « Office Malagasy du Droit d'Auteur » OMDA.
To fanomezam-pahefana io mandritra ny fisiany na dia tsy nanao filazana ao
amin'ny rejisitry ny OMDA momba ny sanganasako mbola ho avy aza aho.

Natao teto Antananarivo, anio faha{{date_du_jour}}`;

/**
 * Remplace les 3 placeholders du template par les valeurs servies par le
 * service, sans modifier le reste du texte. Les accents, apostrophes typographiques
 * et caractères Unicode (guillemets « », trait d'union) sont préservés.
 *
 * Une valeur manquante ou vide est rendue par une chaîne vide : l'écran
 * Engagement n'appelle ce service qu'après validation des champs identité et
 * catégorie, donc les 3 valeurs sont attendues non vides.
 */
export function rendreTexteEngagement(entree: TexteEngagementEntree): string {
  const nomPrenoms = (entree.nom_prenoms ?? '').trim();
  const categorie = (entree.categorie ?? '').trim();
  const dateDuJour = (entree.date_du_jour ?? '').trim();
  return TEXTE_ENGAGEMENT_MALGACHE_TEMPLATE.replace('{{nom_prenoms}}', nomPrenoms)
    .replace('{{categorie}}', categorie)
    .replace('{{date_du_jour}}', dateDuJour);
}
