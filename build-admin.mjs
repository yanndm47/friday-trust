// Conçu par La TEAM 0 — génère netlify/functions/admin-panel.mjs depuis admin_private/admin.js
import {readFileSync,writeFileSync} from 'node:fs';
writeFileSync('netlify/functions/admin-panel.mjs','// Fichier généré par build-admin.mjs — ne pas modifier\nexport default '+JSON.stringify(readFileSync('admin_private/admin.js','utf8'))+';\n');
