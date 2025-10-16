export const tgEscape = (str: string) =>
  str
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');

export const tgFormat = {
  bold: (msg: string) => `*${tgEscape(msg)}*`,
  italic: (msg: string) => `_${tgEscape(msg)}_`,
  underline: (msg: string) => `__${tgEscape(msg)}__`,
  strikethrough: (msg: string) => `~${tgEscape(msg)}~`,
  spoiler: (msg: string) => `||${tgEscape(msg)}||`,
  url: (msg: string, url: string) => `[${tgEscape(msg)}](${url})`,
  mention: (msg: string, userId: number) =>
    `[${tgEscape(msg)}](tg://user?id=${userId})`,
  inlineCode: (msg: string) => `\`${tgEscape(msg)}\``,
  blockCode: (msg: string) => `\`\`\`${tgEscape(msg)}\`\`\``,
};
