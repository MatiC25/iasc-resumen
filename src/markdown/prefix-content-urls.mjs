// Keep links root-relative in the notes and prefix them for project Pages builds.
export function prefixContentUrls(base) {
  function prefix(url) {
    if (!url.startsWith('/') || url.startsWith('//') || url === base || url.startsWith(`${base}/`)) return url;
    return `${base}${url}`;
  }

  function updateUrl(node, context) {
    context.setProperty(node, 'url', prefix(node.url));
  }

  return {
    name: 'iasc-prefix-content-urls',
    link: updateUrl,
    image: updateUrl,
    definition: updateUrl,
    html(node, context) {
      const value = node.value.replace(/(<[a-z][^>]*?)(\s(?:href|src)\s*=\s*)(["'])(\/[^"']*)\3/gi,
        (_, tag, attribute, quote, url) => `${tag}${attribute}${quote}${prefix(url)}${quote}`);
      if (value !== node.value) context.setProperty(node, 'value', value);
    },
  };
}

