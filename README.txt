Conçu par La TEAM 0 — Contact : 6 41 87 03 29

Hébergement : Netlify uniquement (voir les étapes données dans la conversation).
Variables d'environnement à créer sur Netlify : SESSION_SECRET (>=32 caractères aléatoires), ADMIN_PASSWORD.
Si tu modifies admin_private/admin.js : node build-admin.mjs (Netlify le fait à chaque déploiement).
