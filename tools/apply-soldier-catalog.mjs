/** Validate the workshop export before atomically replacing the default catalog. */
import {readFile,writeFile,rename} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {importEdits,importCatalog,exportCatalog} from '../src/characters/model.mjs';
const args=process.argv.slice(2),path=args.find(a=>!a.startsWith('--'));
if(!path||args.some(a=>a.startsWith('--')&&a!=='--check')){console.error('Usage: node tools/apply-soldier-catalog.mjs export.json [--check]');process.exitCode=1;}
else try{const target=fileURLToPath(new URL('../assets/soldiers/catalog.json',import.meta.url)),source=await readFile(path,'utf8');if(source.length>2*1024*1024)throw Error('Export exceeds 2MB');const base=importCatalog(JSON.parse(await readFile(target,'utf8'))),catalog=importEdits(source,base),json=exportCatalog(catalog)+'\n';
 if(args.includes('--check'))console.log('Valid soldier catalog: '+Object.keys(catalog.profiles).length+' nation/rank profiles');else{const temporary=target+'.tmp';await writeFile(temporary,json);await rename(temporary,target);console.log('Applied soldier catalog: '+Object.keys(catalog.profiles).length+' nation/rank profiles');}
}catch(e){console.error(e.message);process.exitCode=1;}
