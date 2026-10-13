import openpyxl,pathlib,json,hashlib
root=pathlib.Path(__file__).resolve().parents[2]
import argparse
parser=argparse.ArgumentParser(description='Extract the read-only food source table')
parser.add_argument('source_file',type=pathlib.Path)
p=parser.parse_args().source_file
w=openpyxl.load_workbook(p,data_only=True);sheet=w['TABELA NUTRICIONAL'];foods=[];category='carbohydrate';issues=[];seen={}
for row in range(2,124):
 vals=[sheet.cell(row,j).value for j in range(1,7)]
 name,unit,*macros=vals
 if not name:continue
 if not unit and all(v is None for v in macros):
  category={'Carbos':'carbohydrate','PROT':'protein','Gordura':'fat','EXTRAS':'extra'}.get(name,category);continue
 if name in ['Carboidratos','Proteínas','Gorduras']:issues.append({'row':row,'name':name,'reason':'generic portion, not a named food'});continue
 normalized=name.strip().casefold()
 if normalized in seen:issues.append({'row':row,'name':name,'reason':'duplicate name; spreadsheet lookup uses first occurrence','firstRow':seen[normalized]});continue
 seen[normalized]=row
 unknown=not unit or any(not isinstance(v,(float,int)) for v in macros) or (unit == 'g' and all(v == 0 for v in macros))
 food={'id':'food-'+str(row),'name':name.strip(),'unit':unit or None,'category':category,'proteinAnimal':macros[0],'proteinPlant':macros[1],'carbs':macros[2],'fat':macros[3],'nutritionUnknown':unknown,'source':{'sheet':'TABELA NUTRICIONAL','row':row,'range':f'A{row}:F{row}'}}
 foods.append(food)
source={'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'basis':'nutrients per ONE source measure (1 g, 1 ml or 1 unit), never automatically per 100 g','issues':issues,'version':'1.0.0','foods':foods}
(root/'frontend/src/lib/summer-foods.json').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('foods',len(foods),'issues',len(issues),'unknown',sum(f['nutritionUnknown'] for f in foods))
