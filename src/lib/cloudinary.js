// Utilitaire Cloudinary - Sert les images via le CDN Cloudinary
// au lieu de Supabase directement, pour réduire la bande passante à ~0.
//
// Fonctionnement : Cloudinary télécharge l'image depuis Supabase UNE SEULE FOIS,
// la compresse et la met en cache. Tous les visiteurs suivants reçoivent
// l'image depuis Cloudinary, sans jamais toucher au quota Supabase.

const CLOUDINARY_CLOUD_NAME = 'dwhvevzwl'

/**
 * Transforme une URL d'image (Supabase ou autre) en URL Cloudinary optimisée.
 * @param {string|null} url - L'URL originale de l'image
 * @param {number} width - Largeur max souhaitée (défaut: 400)
 * @returns {string|null}
 */
export const getCoverUrl = (url, width = 400) => {
  if (!url) return null;
  // Cloudinary fetch : sert l'image distante via son CDN avec optimisation automatique
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/w_${width},q_auto,f_auto,c_limit/${encodeURIComponent(url)}`
}
