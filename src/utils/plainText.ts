/** Markdown 转聊天软件可读的纯文本：标题去井号，整行加粗转【】，行内加粗剥星号 */
export function markdownToPlain(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      let l = line;
      const heading = l.match(/^#{1,6}\s+(.*)$/);
      if (heading) l = heading[1];
      const boldLine = l.match(/^\*\*(.+)\*\*$/);
      if (boldLine) l = `【${boldLine[1]}】`;
      return l.replace(/\*\*(.+?)\*\*/g, '$1');
    })
    .join('\n');
}
