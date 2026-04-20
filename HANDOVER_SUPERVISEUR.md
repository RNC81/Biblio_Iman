# 📂 HANDOVER INSTRUCTIONS 
**POUR LE PROCHAIN ASSISTANT IA (CONTEXTE DE REPRISE DE PROJET)**

Cher collègue IA, si tu lis ce fichier, c'est que le client a relancé le développement de la plateforme "Bibliothèque Iman". Ce document te résume l'intégralité du Workflow Logiciel, de l'Architecture (clôturé à la V3.0), et des Règles d'Interactions Clients pour t'éviter toute perte de contexte.

---

## 🛠️ 1. ARCHITECTURE ET STACK TECHNIQUE
- **Front-end :** React 18, Vite.js, TailwindCSS (On utilise des assemblages UI propres fait-maison sans plugins massifs).
- **Back-end & Base de données :** Supabase (PostgreSQL). L'API est initialisée dans `src/lib/supabase.js`.
- **Hébergement & Vitrine :** L'application est hébergée chez Vercel.
- **Répertoire Local / Cloud :** Tout transite par Git sur la branche `main`.

---

## 🚀 2. WORKFLOW DE DÉPLOIEMENT (RÈGLE D'OR)
⚠️ **NE JAMAIS ESSAYER DE DÉPLOYER AVEC LA CLI `vercel` !**
L'hébergement Vercel du client est branché (webhooks) directement sur son GitHub. Pour envoyer ton code web en production afin que le client puisse tester en live (ce qu'il réclamera à chaque fois), tu as juste besoin de modifier les fichiers localement sur sa machine, et d'exécuter l'envoi Git. Vercel interceptera le push de GitHub et compilera le front-end automatiquement.

**Ta commande magique de Push :**
```bash
git add .
git commit -m "feat: description claire de ton ajout"
git push origin main
```
*Attends toujours que tes commandes Git aient renvoyé "Success" avant de prévenir le client que c'est en ligne.*

---

## 📚 3. SCHÉMA ACTUEL DE LA BASE DE DONNÉES (SUPABASE)
Les tables clés en PostgreSQL (Row Level Security Activé) :
- **Table `books` :** L'inventaire central de la bibliothèque. 
  - 🛑 Attention au champ **`status`** (Type Texte restrictif ENUM: `AVAILABLE`, `ONLINE`, `BORROWED`) qui gère si le livre est sur étagère, numérique, ou prêté. (Au début du dev, c'était un booléen `is_available`, il a été DÉTRUIT. Base-toi uniquement sur `status`).
  - Champs vitaux : `title`, `author`, `publisher` (Maison d'édition), `established_by` (Établi par), `translator` (Traducteur), `isbn`, `language`, `published_date`, `online_url`, `synopsis`, `private_note`.
  - Lien Original/Traduction : `original_book_id` (FK → `books`, optionnel, indique que ce livre est une traduction d'un autre).
  - Image cover : `cover_url`
  - **`collection_id`** (FK → `collections`) : Associe un livre à une collection/série multi-volumes (optionnel).
  - **`volume_number`** (integer) : Numéro du volume dans la collection (optionnel).
- **Table `collections` :** Permet de regrouper des livres multi-volumes (ex: "Al-Kafi") sous un même "dossier". Champs : `name`, `description`, `cover_url`.
- **Table `book_copies` :** Suivi individuel de chaque exemplaire physique d'un livre. 
  - Chaque copie a : `copy_number`, `status` (AVAILABLE/BORROWED/DAMAGED/LOST), `location_id`, `private_note`.
  - Un livre physique nouvellement ajouté reçoit automatiquement 1 exemplaire. L'admin peut en ajouter d'autres via l'interface d'édition.
  - Les livres ONLINE n'ont PAS d'exemplaires physiques.
- **Table `categories` :** Possède un système d'arborescence native via `parent_id` (jointure récursive sur elle-même).
- **Table `book_categories` :** Table de jointure Many-to-Many via UUIDs (livre / catégorie).
- **Table `locations` :** Contient un simple `shelf` (Étagères/Rayons).
- **Le Storage Cloud (Images) :** Le bucket s'appelle `covers` (Public + Règles autorisant le `INSERT`/`UPDATE` anonyme localisées pour que la page Admin.jsx puisse téléverser les JPG proprement).

---

## 🎨 4. LIGNE DIRECTRICE UX/UI & RÈGLES DE DESIGN
L'institut et le client cherchent un système lisible, sérieux et non "technologique". 
**Règles strictes :**
1. **Zéro Pop-up Natif Navigateur :** INTERDICTION d'utiliser un vulgaire `window.alert()` ou `window.confirm()`. Tu dois impérativement créer des composants "Modals" Tailwind par-dessus l'écran (avec un fond sombre `backdrop-blur`) et des notifications discrètes avec délai type Toasts Toastify via les états `useState`.
2. **Langage Humain :** N'emploie jamais de termes comme "Nodes", "Terminal", "Vaporiser", "Database" ou "Cloud" sur les pages destinées au client (Le Front-end). Préfère le français courant : "Titre du livre", "Catalogue", "Sauvegarder", "Supprimer", "Erreur réseau".
3. **Moins d'Emojis :** Ne sature pas les boutons HTML d'emojis. Apporte un design monolithique, coloré et professionnel (Du Gris charbon classique, du Bleu profond pour les liens distants, du Vert Émeraude pour la mise à disposition).
4. **La SideBar des Filtres Publics :** Le fichier `Home.jsx` est la "Vitrine". Il possède un solide moteur de recherche hybride (La barre de texte aspire les titres, auteurs, mais AUSSI le synopsis) combinée à une barre de filtre e-commerce latérale. Prends toujours soin de ne pas casser le hook d'anti-spam `useDebounce`.

---

**→ Fin des Instructions.** Tu as le contexte opérationnel. Le client poursuivra la suite (Gestion potentielle des comptes adhérents, Emprunts, Génération d'impression QR) ! 
