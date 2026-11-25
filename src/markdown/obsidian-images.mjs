import { constants, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const vault = fileURLToPath(new URL('../../../', import.meta.url));
const attachments = fileURLToPath(new URL('../../public/adjuntos/', import.meta.url));

function importAttachment(name) {
  const target = join(attachments, name);
  if (existsSync(target)) return true;

  const original = join(vault, name);
  if (!existsSync(original)) return false;

  mkdirSync(attachments, { recursive: true });
  try {
    copyFileSync(original, target, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  return true;
}

export function obsidianImages(base) {
  return {
    name: 'iasc-obsidian-images',
    text(node, context) {
      if (!node.value.includes('![[')) return;

      const embeds = /!\[\[([^\[\]\r\n|/\\:]+?\.(?:png|jpe?g|webp|gif|avif|svg))(?:\|([^\]\r\n]+?))?(?:\]\]|\)\])/gi;
      const children = [];
      let offset = 0;

      for (const match of node.value.matchAll(embeds)) {
        const [, name, alias] = match;
        if (!importAttachment(name)) {
          console.warn(`Adjunto de Obsidian no encontrado: ${name}`);
          continue;
        }

        if (match.index > offset) children.push({ type: 'text', value: node.value.slice(offset, match.index) });
        children.push({ type: 'image', url: `${base}/adjuntos/${encodeURIComponent(name)}`, alt: alias?.trim() || name });
        offset = match.index + match[0].length;
      }

      if (!children.length) return;
      if (offset < node.value.length) children.push({ type: 'text', value: node.value.slice(offset) });
      context.replaceNode(node, children);
    },
  };
}
