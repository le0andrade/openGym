import pymupdf, pathlib, re, json, hashlib, argparse
parser=argparse.ArgumentParser(description='Extract supplied workout PDFs without video URLs or licensee details')
parser.add_argument('source_dir',type=pathlib.Path)
args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[2]
for slug,token in [('masculino','e61d1e56'),('feminino','5cc381e1')]:
 p=next(args.source_dir.glob('*'+token+'*.pdf'))
 text=pymupdf.open(p)[0].get_text()
 # Text stream preserves row order; split at the 12 prescription tokens, not line breaks.
 lines=text.splitlines(); rows=[]; section=None; i=0
 while i<len(lines):
  s=lines[i].strip()
  if s.startswith('Treino '): section=s[-1]; i+=1; continue
  if s in ['ABDOMÊN','Cardio']: section=s; i+=1; continue
  if s=='LEGENDA': break
  if section and s and not s.startswith(('http','eb_copy')):
   m=re.search(r'\s+(\d+x\d+(?:a\d+)?)$',s)
   name=s[:m.start()].strip() if m else s
   vals=[m[1]] if m else []
   j=i+1
   while j<len(lines) and len(vals)<12 and re.fullmatch(r'\d+x\d+(?:a\d+)?\s*(?:\((?:TSD|DSDN)\))?|\d+ min',lines[j].strip()):
    vals.append(lines[j].strip()); j+=1
   if len(vals)==12:
    note=[]
    while j<len(lines) and not lines[j].startswith(('http','LEGENDA')) and section!='Cardio': note.append(lines[j].strip()); j+=1
    if section=='Cardio': note=['Baixa Intensidade']
    rows.append(dict(section=section,sourceName=name,prescription=vals,note=' '.join(note)))
    i=j
   else: i+=1
  else: i+=1
 data=dict(file=p.name,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),pages=1,extraction='PyMuPDF 1.28.2 text layer; whitespace only normalized',visualLimitation='Overlay LIBERAÇÃO EM 7 DIAS obscures weekly cells in rendered PDF; all 12 weeks exist in text layer.',rows=rows,legend={'H':'Halteres','DSDN':'Dia sim, dia não','TSD':'Todos os dias'})
 data['generalNotes']=' '.join(text[text.index('Mantenha os descansos'):text.index('Licensed to')].split())
 assert len(rows)==(39 if slug=='masculino' else 30),(slug,len(rows))
 root.joinpath('api/summer-shredded/source/'+slug+'.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print(slug,len(rows),'rows',sum(len(r['prescription']) for r in rows),'cells')
