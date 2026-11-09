import fs from 'fs';
import path from 'path';

const files = ['index.js', 'index.mjs', 'index.cjs'];
const pwaDist = path.resolve(process.cwd(), 'node_modules/vite-plugin-pwa/dist');

if (fs.existsSync(pwaDist)) {
  for (const f of files) {
    const filePath = path.join(pwaDist, f);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('typeof __dirname !== "undefined"') && !content.includes('__dirname !== "."')) {
        content = content.replaceAll(
          'typeof __dirname !== "undefined"',
          '(typeof __dirname !== "undefined" && __dirname !== ".")'
        );
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✓ Applied Vite 8 compat patch to vite-plugin-pwa/dist/${f}`);
      }
    }
  }
}
