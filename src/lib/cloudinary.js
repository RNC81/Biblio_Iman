// Utilitaire Cloudinary - Gère l'upload ET la diffusion des images
// via le CDN Cloudinary au lieu de Supabase Storage.
//
// Fonctionnement upload :
//   Admin uploade une image → Cloudinary (gratuit, 25 GB/mois)
//   L'URL Cloudinary est stockée dans cover_url de la DB Supabase
//   Supabase Storage n'est plus jamais utilisé pour les nouvelles images
//
// Fonctionnement affichage :
//   Si l'URL est déjà Cloudinary → on applique les transformations directement
//   Si l'URL est Supabase (anciennes images) → on proxifie via Cloudinary Fetch
//   Dans les deux cas, Supabase Storage n'est JAMAIS contacté par les visiteurs

export const CLOUDINARY_CLOUD_NAME = 'dwhvevzwl'
export const CLOUDINARY_UPLOAD_PRESET = 'library_covers'

/**
 * Upload une image directement sur Cloudinary (sans passer par Supabase Storage).
 * Utilise un preset non signé = aucune clé secrète requise côté client.
 * @param {File} file - Le fichier image à uploader
 * @returns {Promise<string>} L'URL publique Cloudinary
 */
export const uploadToCloudinary = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  formData.append('folder', 'covers')

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )
  if (!res.ok) throw new Error('Cloudinary upload failed')
  const data = await res.json()
  return data.secure_url
}

/**
 * Retourne une URL d'image optimisée via Cloudinary.
 * - Si c'est déjà une URL Cloudinary : applique les transformations directement.
 * - Si c'est une URL Supabase (ancien système) : proxifie via Cloudinary Fetch.
 * @param {string|null} url - L'URL originale
 * @param {number} width - Largeur max (défaut: 400)
 * @returns {string|null}
 */
export const getCoverUrl = (url, width = 400) => {
  if (!url) return null;
  const transforms = `w_${width},q_auto,f_auto,c_limit`
  // URL déjà Cloudinary → on insère les transformations dans le chemin
  if (url.includes('res.cloudinary.com')) {
    return url.replace('/upload/', `/upload/${transforms}/`)
  }
  // URL externe (Supabase, OpenLibrary, etc.) → Cloudinary Fetch comme proxy CDN
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/${transforms}/${encodeURIComponent(url)}`
}
