"""Refresh bundled Override assets from a supplied PDF. Requires pymupdf."""
import argparse,json,re,shutil
from pathlib import Path
import pymupdf
parser=argparse.ArgumentParser();parser.add_argument('pdf');args=parser.parse_args()
root=Path(__file__).resolve().parents[1];doc=pymupdf.open(args.pdf)
assert 'Version 2.1' in doc[0].get_text(), 'Expected Override 2.1'
def write(path,data): (root/path).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
shutil.copyfile(args.pdf,root/'public/manuals/override-2.1.pdf')
texts=[p.get_text().replace('\xad','') for p in doc]
search=[{'page':i+1,'text':re.sub(r'\s+',' ',text).strip()} for i,text in enumerate(texts)]
write('src/manualSearchIndex.json',search);write('public/game-manual-search.json',{'version':'2.1','pageCount':len(doc),'pages':search})
# Existing rule targets provide section hints, preventing references from being mistaken for headings.
app=(root/'src/App.jsx').read_text(encoding='utf-8');old={}
for page,codes in re.findall(r'\[(\d+), \[((?:"[A-Z]+\d+"(?:, )?)+)\]\]',app):
 for code in re.findall(r'"([A-Z]+\d+)"',codes): old[code]=int(page)
if not old: old=json.loads((root/'src/manualRulePages.json').read_text())
heads={}
for code,previous in old.items():
 candidates=[i+1 for i,text in enumerate(texts) if re.search(r'^<'+re.escape(code)+r'>\s+\S',text,re.M)]
 assert candidates, 'No rule heading for '+code
 heads[code]=min(candidates,key=lambda n:abs(n-(previous+2 if 'const RULE_MANUAL_PAGES = Object.fromEntries' in app else previous)))
write('src/manualRulePages.json',heads)
links={}
for i,page in enumerate(doc):
 rect=page.rect;rows=[]
 for link in page.get_links():
  if link.get('page',-1)>=0:
   r=link['from'];rows.append({'x':r.x0/rect.width*100,'y':r.y0/rect.height*100,'w':r.width/rect.width*100,'h':r.height/rect.height*100,'page':link['page']+1})
 # Quick-reference rule codes are clickable in the mobile image viewer too.
 if i+1 in (8,9,10):
  for code,target in heads.items():
   for r in page.search_for('<'+code+'>'):
    rows.append({'x':r.x0/rect.width*100,'y':r.y0/rect.height*100,'w':(rect.width-r.x0-30)/rect.width*100,'h':r.height/rect.height*100,'page':target})
 if rows: links[str(i+1)]=rows
write('src/manualQuickLinks.json',links)
for i,page in enumerate(doc):
 pix=page.get_pixmap(matrix=pymupdf.Matrix(1.6,1.6),alpha=False);pix.save(str(root/f'public/manual-pages/page-{i+1:03}.jpg'),jpg_quality=82)
print(f'Updated {len(doc)} pages, {len(heads)} rule targets, search and mobile links.')
