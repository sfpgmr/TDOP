MarkdownDocument = content:(SingleLine/MultiLine/Src) {
  return content.join('\n');}

SingleLine = '//@' content:$[^\r\n]+ [\r]?[\n] {return content;}

MultiLine = '/*@' content:$(!'*/' .)* '*/' { return content;}

Src = src:$(!SingleLine !MultiLine .)+  {return '```\n' + src + '\n```';}

