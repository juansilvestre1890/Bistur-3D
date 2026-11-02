import {Brush, Evaluator, ADDITION, SUBTRACTION} from 'https://esm.sh/three-bvh-csg@0.0.17?external=three';
import {sliceMeshByWorldPlane} from './plane-cut.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {ThreeMFLoader} from 'three/addons/loaders/3MFLoader.js';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
const $=id=>document.getElementById(id),viewport=$('viewport');
const scene=new THREE.Scene();scene.background=new THREE.Color('#0a1a2e');
const camera=new THREE.PerspectiveCamera(45,1,.01,100000);camera.position.set(160,110,190);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;viewport.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x526c94,2.3));const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(100,180,130);scene.add(key);
const grid=new THREE.GridHelper(400,24,0x2384b4,0x284963);scene.add(grid);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.08;
const transform=new TransformControls(camera,renderer.domElement);transform.addEventListener('dragging-changed',e=>orbit.enabled=!e.value);scene.add(transform.getHelper());
const root=new THREE.Group();scene.add(root);const bedStage=new THREE.Group();scene.add(bedStage);bedStage.visible=false;let bedMode=false,stagePick=new Map(),dragBed=null;let meshes=[],selected=null,modelLoaded=false,explode=false,xray=false,mode='Mixto',tool='Seleccionar',undo=[],redo=[],basePositions=new Map(),originalMaterials=new Map(),dirty=false;
function status(t){$('status').textContent=t}
function snapshot(){return {items:meshes.map(m=>({m,parent:m.parent,p:m.position.toArray(),r:m.rotation.toArray().slice(0,3),s:m.scale.toArray()})),beds:beds.map(b=>({...b,items:[...b.items],placements:structuredClone(b.placements)})),selected:selected?.uuid||null}}
function save(){undo.push(snapshot());if(undo.length>50)undo.shift();redo=[];dirty=true}
function restore(s){transform.detach();const desired=new Set(s.items.map(v=>v.m));for(const m of meshes)if(!desired.has(m))m.removeFromParent();meshes=s.items.map(v=>v.m);for(const v of s.items){if(v.m.parent!==v.parent)v.parent.add(v.m);v.m.position.fromArray(v.p);v.m.rotation.set(...v.r);v.m.scale.fromArray(v.s)}beds=s.beds.map(b=>({...b,items:[...b.items],placements:structuredClone(b.placements)}));selected=meshes.find(m=>m.uuid===s.selected)||null;modelLoaded=meshes.length>0;refreshBeds();updateList();updateStats();if(bedMode)updateBedStage();if(selected&&tool==='Mover'&&!bedMode)transform.attach(selected)}
function undoStep(){if(!undo.length)return;redo.push(snapshot());restore(undo.pop());status('Acción deshecha.')}
function redoStep(){if(!redo.length)return;undo.push(snapshot());restore(redo.pop());status('Acción rehecha.')}

function fit(){if(bedMode){fitBed();return;}const box=new THREE.Box3().setFromObject(root);if(box.isEmpty())return;const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());orbit.target.copy(center);const d=Math.max(size.length()*1.3,10);camera.position.copy(center).add(new THREE.Vector3(d*.75,d*.5,d));camera.near=Math.max(.001,d/10000);camera.far=d*50;camera.updateProjectionMatrix();orbit.update();grid.position.y=box.min.y-1;}
function clear(){leaveBed();transform.detach();root.clear();meshes=[];selected=null;undo=[];redo=[];basePositions.clear();originalMaterials.clear();modelLoaded=false;dirty=false;explode=false;xray=false;updateList();updateStats();resetBeds()}
function prepare(object,name){clear();root.add(object);root.updateMatrixWorld(true);object.traverse(child=>{if(!child.isMesh)return;if(!child.geometry?.attributes?.position)return;const mat=child.material;if(Array.isArray(mat))child.material=mat.map(m=>m.clone());else child.material=mat?.clone()||new THREE.MeshStandardMaterial({color:0x4da7eb});child.name=child.name||`Pieza ${meshes.length+1}`;meshes.push(child);originalMaterials.set(child.uuid,child.material);basePositions.set(child.uuid,child.position.clone());});modelLoaded=meshes.length>0;$('projectName').value=name;fit();updateList();updateStats();refreshBeds();status(`${meshes.length} objeto(s) de malla cargado(s). No equivale necesariamente a piezas imprimibles separadas.`);dirty=true}
function updateList(){const host=$('pieces');host.replaceChildren();if(!meshes.length){host.textContent='Sin piezas cargadas.';return}meshes.forEach((m,i)=>{const row=document.createElement('div');row.className='piece'+(selected===m?' selected':'');const name=document.createElement('span');name.className='piece-name';name.textContent=`${i+1}. ${m.name}`;name.onclick=()=>select(m);const location=document.createElement('small');location.style.color='#a8c9df';location.textContent=' '+(beds.find(b=>b.items.includes(m.uuid))?.name||'Sin cama');const eye=document.createElement('button');eye.textContent=m.visible?'◉':'○';eye.title='Mostrar/ocultar';eye.onclick=()=>{m.visible=!m.visible;updateList()};row.append(name,location,eye);host.append(row)})}
function select(m){selected=m;transform.detach();if(!bedMode&&tool==='Mover'&&m)transform.attach(m);updateList();refreshBeds();syncPlacementFields();status(m?`Seleccionado: ${m.name}`:'Selección eliminada')}
function updateStats(){if(!modelLoaded){$('stats').textContent='Sin modelo';return}root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root),s=b.getSize(new THREE.Vector3());let triangles=0;meshes.forEach(m=>{const g=m.geometry;triangles+=g.index?g.index.count/3:g.attributes.position.count/3});$('stats').textContent=`Objetos de malla: ${meshes.length}\nTriángulos aprox.: ${Math.round(triangles).toLocaleString('es')}\nDimensiones (mm, si el archivo usa mm): ${s.x.toFixed(1)} × ${s.y.toFixed(1)} × ${s.z.toFixed(1)}\nModo: ${mode}\nHerramienta: ${tool}`}
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let start=null;renderer.domElement.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};if(bedMode&&e.isPrimary){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects([...stagePick.keys()],false);if(hits.length){const m=stagePick.get(hits[0].object);if(m){select(m);const p=bedPointer(e);const place=getBed().placements[m.uuid];if(p&&place){dragBed={id:m.uuid,dx:place.x-p.x,dy:place.y-p.y};orbit.enabled=false;renderer.domElement.setPointerCapture(e.pointerId)}}}}});renderer.domElement.addEventListener('pointermove',e=>{if(!dragBed)return;const p=bedPointer(e);if(!p)return;const b=getBed(),place=b.placements[dragBed.id];if(!place)return;place.x=Math.round((p.x+dragBed.dx)*10)/10;place.y=Math.round((p.y+dragBed.dy)*10)/10;updateBedStage();drawBed();syncPlacementFields();dirty=true});renderer.domElement.addEventListener('pointercancel',()=>{dragBed=null;orbit.enabled=true});renderer.domElement.addEventListener('pointerup',e=>{if(dragBed){dragBed=null;orbit.enabled=true;return;}if(!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(meshes.filter(m=>m.visible),false)[0];if(hit)select(hit.object);start=null});
function download(data,name,mime){const blob=data instanceof Blob?data:new Blob([data],{type:mime});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function loadFile(file){if(!file)return;const ext=file.name.split('.').pop().toLowerCase();status('Leyendo archivo local…');try{const buf=await file.arrayBuffer();let object;if(ext==='stl'){const geo=new STLLoader().parse(buf);geo.computeVertexNormals();object=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x58b7f6,roughness:.6,side:THREE.DoubleSide}));object.name=file.name.replace(/\.stl$/i,'')}else if(ext==='obj'){object=new OBJLoader().parse(new TextDecoder().decode(buf))}else if(ext==='glb'){const gltf=await new GLTFLoader().parseAsync(buf,'');object=gltf.scene}else if(ext==='fbx'){object=new FBXLoader().parse(buf,'')}else if(ext==='3mf'){object=new ThreeMFLoader().parse(buf)}else throw Error('Formato no admitido');prepare(object,file.name.replace(/\.[^.]+$/,''));}catch(e){console.error(e);status('No se pudo abrir el modelo: '+e.message+'. Los OBJ con MTL/texturas externas requieren una futura importación conjunta.')}}
$('openBtn').onclick=()=>$('file').click();$('file').onchange=e=>{loadFile(e.target.files[0]);e.target.value=''};
$('demoBtn').onclick=()=>{const g=new THREE.Group();[['Cabeza',new THREE.SphereGeometry(22,24,16),0xf2b58c,[0,65,0]],['Torso',new THREE.BoxGeometry(40,55,24),0x348ae3,[0,15,0]],['Piernas',new THREE.BoxGeometry(35,44,22),0x525188,[0,-35,0]]].forEach(([name,geo,color,p])=>{const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color}));m.name=name;m.position.set(...p);g.add(m)});prepare(g,'Figura de demostración');status('Modelo de ejemplo cargado: tres objetos geométricos independientes.')};
$('scaleBtn').onclick=()=>{if(!modelLoaded)return status('Primero carga un modelo.');const h=Number($('height').value);if(!Number.isFinite(h)||h<=0)return status('Introduce una altura válida en centímetros.');const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());if(size.y<=0)return status('El modelo no tiene altura válida.');save();root.scale.multiplyScalar(h*10/size.y);fit();updateStats();status(`Altura ajustada proporcionalmente a ${h} cm (asumiendo unidades del modelo en mm).`)};
document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('active',x===b));updateStats();status('Modo '+mode+': las operaciones de segmentación se añadirán en próximas versiones.')});
function setTool(t){if(bedMode){leaveBed();}tool=t;transform.detach();if(t==='Mover'&&selected)transform.attach(selected);$('selectTool').classList.toggle('active',t==='Seleccionar');$('moveTool').classList.toggle('active',t==='Mover');updateStats()}
$('selectTool').onclick=()=>setTool('Seleccionar');$('moveTool').onclick=()=>setTool('Mover');transform.addEventListener('mouseDown',()=>save());transform.addEventListener('objectChange',()=>{dirty=true;updateStats()});
$('xrayBtn').onclick=()=>{xray=!xray;meshes.forEach(m=>{const mats=Array.isArray(m.material)?m.material:[m.material];mats.forEach(mat=>{mat.transparent=xray;mat.opacity=xray?.35:1;mat.depthWrite=!xray;mat.needsUpdate=true})});$('xrayBtn').classList.toggle('active',xray)};
$('explodeBtn').onclick=()=>{if(!modelLoaded)return;save();explode=!explode;const b=new THREE.Box3().setFromObject(root),center=b.getCenter(new THREE.Vector3()),dist=b.getSize(new THREE.Vector3()).length()*.22;meshes.forEach((m,i)=>{if(explode){const p=new THREE.Vector3();m.getWorldPosition(p);const v=p.sub(center);if(v.length()<.01)v.set(Math.cos(i*2.4),.4,Math.sin(i*2.4));m.position.add(v.normalize().multiplyScalar(dist))}else{const orig=basePositions.get(m.uuid);if(orig)m.position.copy(orig)}});$('explodeBtn').classList.toggle('active',explode);updateStats()};
// Cortes por plano en ejes mundiales o normal inclinada (experimental).
$('cutPlaneBtn').onclick=()=>{
  if(bedMode)return status('Vuelve a la vista de modelo antes de cortar.');
  if(!selected)return status('Selecciona una malla para cortarla.');
  if(explode)return status('Desactiva la vista explotada antes de cortar.');
  if(xray)return status('Desactiva Rayos X antes de cortar.');
  const m=selected;
  if(!m.geometry?.attributes?.position)return status('No hay geometría editable.');
  const fraction=Number($('cutPercent').value)/100;
  const axis=$('cutOrientation').value;
  let normal;
  if(axis==='X')normal=new THREE.Vector3(1,0,0);
  else if(axis==='Z')normal=new THREE.Vector3(0,0,1);
  else if(axis==='inclinado'){
    const angleX=Number($('cutAngleX').value),angleZ=Number($('cutAngleZ').value);
    if(!Number.isFinite(angleX)||!Number.isFinite(angleZ))return status('Indica ángulos válidos.');
    normal=new THREE.Vector3(0,1,0).applyEuler(new THREE.Euler(THREE.MathUtils.degToRad(angleX),0,THREE.MathUtils.degToRad(angleZ),'XYZ'));
  }else normal=new THREE.Vector3(0,1,0);
  let result;
  try{result=sliceMeshByWorldPlane(m,normal,fraction)}catch(e){status('No se aplicó el corte: '+e.message);return}
  save();transform.detach();
  const sourceBed=beds.find(b=>b.items.includes(m.uuid));
  const material=Array.isArray(m.material)?m.material[0]:m.material;
  const make=(geo,which,color)=>{
    const mat=material?.clone?.()||new THREE.MeshStandardMaterial({color});
    if(mat.color)mat.color.set(color);
    const obj=new THREE.Mesh(geo,mat);obj.name=m.name+' '+which;
    obj.position.copy(m.position);obj.quaternion.copy(m.quaternion);obj.scale.copy(m.scale);
    m.parent.add(obj);basePositions.set(obj.uuid,obj.position.clone());originalMaterials.set(obj.uuid,obj.material);
    return obj;
  };
  const positive=make(result.upper,'lado positivo',0x56b9ef);
  const negative=make(result.lower,'lado negativo',0xae83e8);
  if(result.connectorPoint){
    const info={point:result.connectorPoint.toArray(),normal:result.connectorNormal.toArray(),maxRadius:result.connectorRadius};
    positive.userData.bisturiCut={...info,mate:negative.uuid,side:'positive'};
    negative.userData.bisturiCut={...info,mate:positive.uuid,side:'negative'};
  }
  m.removeFromParent();meshes.splice(meshes.indexOf(m),1,positive,negative);
  if(sourceBed){sourceBed.items=sourceBed.items.filter(id=>id!==m.uuid);delete sourceBed.placements[m.uuid]}
  selected=positive;dirty=true;refreshBeds();updateList();updateStats();fit();
  status(`Corte ${axis} efectuado: dos mallas separadas. Revisa que sus superficies sean válidas en el laminador.`);
};

// Experimental Boolean CSG pin/socket. The joined and subtracted surfaces become
// real triangles in the two resulting meshes (unlike a visual-only marker).
// We do not claim watertightness without a separate topology verification.
$('pegApplyBtn').onclick=()=>{
  if(bedMode||explode||xray)return status('Vuelve a la vista ensamblada del modelo y desactiva Rayos X.');
  const m=selected,info=m?.userData?.bisturiCut;
  if(!info)return status('Selecciona una de las dos piezas creadas por un corte reciente.');
  const mate=meshes.find(p=>p.uuid===info.mate);
  if(!mate||mate.userData?.bisturiCut?.mate!==m.uuid)return status('No se encuentra la otra mitad del corte.');
  if(info.connectorMade||mate.userData.bisturiCut.connectorMade)return status('Este corte ya tiene un encastre. Deshazlo para modificarlo.');
  const diameter=Number($('pegDiameter').value),depth=Number($('pegDepth').value),clearance=Number($('pegClearance').value);
  if(![diameter,depth,clearance].every(Number.isFinite)||diameter<.5||diameter>40||depth<1||depth>40||clearance<.05||clearance>1||diameter/2<=clearance)return status('Revisa diámetro, profundidad y holgura.');
  const positive=info.side==='positive'?m:mate;
  const negative=info.side==='negative'?m:mate;
  const radius=diameter/2;
  // A conservative limit: the clearance socket must fit in an interior cap triangle.
  if(radius+clearance>info.maxRadius*.8)return status(`No hay superficie suficiente para este pasador. Diámetro máximo aproximado: ${Math.max(0,(info.maxRadius*.8-clearance)*2).toFixed(1)} mm.`);
  const normal=new THREE.Vector3().fromArray(info.normal).normalize();
  const point=new THREE.Vector3().fromArray(info.point);
  const evaluator=new Evaluator();
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
  const cylindrical=(r,height,center)=>{
    const mesh=new Brush(new THREE.CylinderGeometry(r,height,40,1,false));
    mesh.geometry.deleteAttribute('uv');mesh.position.copy(center);mesh.quaternion.copy(q);mesh.updateMatrixWorld(true);return mesh;
  };
  function worldBrush(src){
    src.updateWorldMatrix(true,false);
    const g=src.geometry.clone();for(const name of Object.keys(g.attributes)){if(name!=='position'&&name!=='normal')g.deleteAttribute(name)}g.clearGroups();g.applyMatrix4(src.matrixWorld);
    const brush=new Brush(g);brush.updateMatrixWorld(true);return brush;
  }
  let pegGeo=null,socketGeo=null;
  try{
    const pegHeight=depth+.8;
    const pegCenter=point.clone().addScaledVector(normal,.4-depth/2);
    const socketHeight=depth+clearance+.35;
    const socketCenter=point.clone().addScaledVector(normal,.15-socketHeight/2);
    // Positive half receives a protruding peg along -normal; negative half is bored along -normal.
    const male=evaluator.evaluate(worldBrush(positive),cylindrical(radius,pegHeight,pegCenter),ADDITION);
    const female=evaluator.evaluate(worldBrush(negative),cylindrical(radius+clearance,socketHeight,socketCenter),SUBTRACTION);
    if(!male.geometry?.attributes?.position?.count||!female.geometry?.attributes?.position?.count)throw Error('Resultado geométrico vacío.');
    positive.updateWorldMatrix(true,false);negative.updateWorldMatrix(true,false);
    // Trim unused allocation outside drawRange before STL and project serialization.
    const normalized=(input,matrix)=>{
      const g=input.clone();
      const begin=Math.max(0,g.drawRange.start||0);
      const total=g.index?g.index.count:g.attributes.position.count;
      const count=Math.min(total-begin,Number.isFinite(g.drawRange.count)?g.drawRange.count:total);
      if(count<=0)throw Error('La operación no produjo triángulos.');
      const pos=[],norm=[];const p=g.getAttribute('position'),n=g.getAttribute('normal'),idx=g.getIndex();
      for(let i=begin;i<begin+count;i++){
        const at=idx?idx.getX(i):i;
        pos.push(p.getX(at),p.getY(at),p.getZ(at));
        if(n)norm.push(n.getX(at),n.getY(at),n.getZ(at));
      }
      const output=new THREE.BufferGeometry();
      output.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      if(norm.length===pos.length)output.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));
      output.applyMatrix4(matrix);return output;
    };
    pegGeo=normalized(male.geometry,positive.matrixWorld.clone().invert());
    socketGeo=normalized(female.geometry,negative.matrixWorld.clone().invert());
    pegGeo.computeVertexNormals();socketGeo.computeVertexNormals();
  }catch(e){console.error(e);status('No se pudo construir el encastre: '+e.message);return}
  save();transform.detach();
  const replace=(old,geometry)=>{
    const replacement=new THREE.Mesh(geometry,old.material.clone());replacement.name=old.name;
    replacement.position.copy(old.position);replacement.quaternion.copy(old.quaternion);replacement.scale.copy(old.scale);
    replacement.userData=structuredClone(old.userData);replacement.userData.bisturiCut.connectorMade=true;
    old.parent.add(replacement);old.removeFromParent();
    const index=meshes.indexOf(old);meshes[index]=replacement;
    basePositions.set(replacement.uuid,replacement.position.clone());originalMaterials.set(replacement.uuid,replacement.material);
    for(const bed of beds){const index=bed.items.indexOf(old.uuid);if(index!==-1){bed.items[index]=replacement.uuid;bed.placements[replacement.uuid]=bed.placements[old.uuid];delete bed.placements[old.uuid]}}
    return replacement;
  };
  const newPositive=replace(positive,pegGeo),newNegative=replace(negative,socketGeo);
  newPositive.userData.bisturiCut.mate=newNegative.uuid;
  newNegative.userData.bisturiCut.mate=newPositive.uuid;
  selected=newPositive;dirty=true;refreshBeds();updateList();updateStats();fit();
  status(`Encastre cilíndrico experimental agregado: Ø${diameter} mm, profundidad ${depth} mm, holgura radial ${clearance} mm. Comprueba la geometría en el laminador.`);
};
$('cutOrientation').onchange=()=>{$('cutAngles').hidden=$('cutOrientation').value!=='inclinado'};
$('resetView').onclick=fit;$('undoBtn').onclick=undoStep;$('redoBtn').onclick=redoStep;document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redoStep():undoStep()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redoStep()}});
$('exportBtn').onclick=()=>{if(!selected)return status('Selecciona primero una malla.');try{const exporter=new STLExporter();const data=exporter.parse(selected,{binary:true});download(data,selected.name.replace(/[^\w-]/g,'_')+'.stl','model/stl');status('STL de la malla seleccionada descargado. Verifica la malla en tu laminador.')}catch(e){status('Error al exportar: '+e.message)}};
$('reportBtn').onclick=()=>{if(!modelLoaded)return status('No hay modelo.');const text=`BISTURÍ 3D — INFORME PRELIMINAR\nProyecto: ${$('projectName').value}\nObjetos de malla: ${meshes.length}\nBoquilla: ${$('nozzle').value} mm\nCama: ${(beds.find(b=>b.id===activeBed)?.name||'No asignada')} mm\n\n${meshes.map((m,i)=>`${i+1}. ${m.name}`).join('\n')}\n\nAVISO: No se ha realizado validación manifold, de espesor, de encastres ni de imprimibilidad.\n`;download(text,'informe_bisturi3d.txt','text/plain;charset=utf-8')};
$('newBtn').onclick=()=>{if(dirty)$('warning').hidden=false;else{clear();status('Nuevo proyecto.')}};$('cancelNew').onclick=()=>$('warning').hidden=true;$('confirmNew').onclick=()=>{clear();$('warning').hidden=true;status('Nuevo proyecto.')} ;window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});

// Gestión de camas: exclusivamente en la memoria del navegador.
let beds=[{id:1,name:'Cama 1',x:256,y:256,z:256,items:[],placements:{}}],activeBed=1,nextBedId=2;
const getBed=()=>beds.find(b=>b.id===activeBed)||beds[0];
function resetBeds(){beds=[{id:1,name:'Cama 1',x:256,y:256,z:256,items:[],placements:{}}];activeBed=1;nextBedId=2;refreshBeds()}
function meshSize(m){m.updateWorldMatrix(true,false);const b=new THREE.Box3().setFromObject(m);return b.getSize(new THREE.Vector3())}
function rotatedSize(m,deg=0){const s=meshSize(m),r=Number(deg||0)*Math.PI/180;return {x:Math.abs(s.x*Math.cos(r))+Math.abs(s.z*Math.sin(r)),y:Math.abs(s.z*Math.cos(r))+Math.abs(s.x*Math.sin(r)),z:s.y}}
function rectangleFor(b,m){const p=b.placements[m.uuid]||{x:0,y:0,rot:0},s=rotatedSize(m,p.rot);return {x:Number(p.x)||0,y:Number(p.y)||0,w:s.x,h:s.y,z:s.z,name:m.name}}
function overlapping(a,b){return a.x<b.x+b.w-.01&&a.x+a.w>b.x+.01&&a.y<b.y+b.h-.01&&a.y+a.h>b.y+.01}
function getProblems(b){const assigned=b.items.map(id=>meshes.find(m=>m.uuid===id)).filter(Boolean),rects=assigned.map(m=>rectangleFor(b,m)),problems=[];
  rects.forEach(r=>{if(r.w>b.x||r.h>b.y||r.z>b.z||r.x<0||r.y<0||r.x+r.w>b.x+.01||r.y+r.h>b.y+.01)problems.push(`${r.name}: excede la cama o está fuera del área`)});
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)if(overlapping(rects[i],rects[j]))problems.push(`${rects[i].name} y ${rects[j].name}: se solapan en la vista superior`);
  return problems;
}
function refreshBeds(){if(bedMode)updateBedStage();syncPlacementFields();const sel=$('bedSelect');sel.replaceChildren();beds.forEach(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=`${b.name} · ${b.x}×${b.y}×${b.z} mm`;sel.append(o)});sel.value=String(activeBed);drawBed();const b=getBed();$('bedPieces').textContent=`Piezas asignadas: ${b.items.length} · ${b.items.map(id=>meshes.find(m=>m.uuid===id)?.name||'').join(', ')||'ninguna'}`}
function drawBed(){const c=$('bedCanvas'),ctx=c.getContext('2d'),b=getBed();if(!ctx||!b)return;const w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#0e2035';ctx.fillRect(0,0,w,h);const pad=25,scale=Math.min((w-pad*2)/b.x,(h-pad*2)/b.y),ox=(w-b.x*scale)/2,oy=(h-b.y*scale)/2;
ctx.fillStyle='#16374f';ctx.fillRect(ox,oy,b.x*scale,b.y*scale);ctx.strokeStyle='#58cfff';ctx.lineWidth=2;ctx.strokeRect(ox,oy,b.x*scale,b.y*scale);ctx.strokeStyle='#31546b';ctx.lineWidth=.65;
for(let x=0;x<=b.x;x+=Math.max(10,Math.round(b.x/10/10)*10||10)){ctx.beginPath();ctx.moveTo(ox+x*scale,oy);ctx.lineTo(ox+x*scale,oy+b.y*scale);ctx.stroke()}
for(let y=0;y<=b.y;y+=Math.max(10,Math.round(b.y/10/10)*10||10)){ctx.beginPath();ctx.moveTo(ox,oy+y*scale);ctx.lineTo(ox+b.x*scale,oy+y*scale);ctx.stroke()}
const rects=b.items.map(id=>meshes.find(m=>m.uuid===id)).filter(Boolean).map(m=>({m,r:rectangleFor(b,m)}));rects.forEach(({m,r},i)=>{const invalid=r.x<0||r.y<0||r.x+r.w>b.x+.01||r.y+r.h>b.y+.01||r.z>b.z||rects.some(o=>o.m!==m&&overlapping(r,o.r));ctx.fillStyle=invalid?'#a54d66':m===selected?'#36c7c0':['#377bbc','#7357af','#2b9c79','#bd8450'][i%4];ctx.fillRect(ox+r.x*scale,oy+r.y*scale,Math.max(r.w*scale,2),Math.max(r.h*scale,2));ctx.strokeStyle='#d8f3ff';ctx.lineWidth=1;ctx.strokeRect(ox+r.x*scale,oy+r.y*scale,r.w*scale,r.h*scale);ctx.font='10px sans-serif';ctx.fillStyle='#fff';ctx.fillText(m.name.slice(0,15),ox+r.x*scale+3,oy+r.y*scale+12)});
ctx.font='11px sans-serif';ctx.fillStyle='#a8c8e4';ctx.fillText(`X ${b.x} mm`,ox,Math.min(h-3,oy+b.y*scale+15));ctx.save();ctx.translate(Math.max(10,ox-9),oy+Math.min(75,b.y*scale/2));ctx.rotate(-Math.PI/2);ctx.fillText(`Y ${b.y} mm`,0,0);ctx.restore();const probs=getProblems(b);const out=$('bedChecks');out.replaceChildren();const header=document.createElement('div');header.className=probs.length?'bed-warning':'bed-ok';header.textContent=probs.length?`⚠ ${probs.length} advertencia(s) aproximadas`:'✓ Sin solapamiento de cajas envolventes detectado';out.append(header);probs.forEach(p=>{const d=document.createElement('div');d.textContent='• '+p;out.append(d)});
}
function layoutBed(){const b=getBed();if(!b.items.length)return status('No hay piezas asignadas a esta cama.');let x=0,y=0,row=0;const margin=3;for(const id of b.items){const m=meshes.find(m=>m.uuid===id);if(!m)continue;const s=rotatedSize(m,b.placements[id]?.rot);if(x+s.x>b.x&&x!==0){x=0;y+=row+margin;row=0}b.placements[id]={x,y,rot:b.placements[id]?.rot||0};x+=s.x+margin;row=Math.max(row,s.y)}dirty=true;drawBed();if(bedMode)updateBedStage();syncPlacementFields();status(getProblems(b).length?'Distribución aproximada creada; revisa las advertencias.':'Piezas distribuidas en la cama (vista superior aproximada).')}
$('bedSelect').onchange=e=>{activeBed=Number(e.target.value);refreshBeds();if(bedMode)fitBed()};
$('addBed').onclick=()=>{$('bedForm').hidden=!$('bedForm').hidden;$('bedName').value='Cama '+nextBedId};
$('saveBed').onclick=()=>{const name=$('bedName').value.trim(),x=Number($('bedX').value),y=Number($('bedY').value),z=Number($('bedZ').value);if(!name||![x,y,z].every(n=>Number.isFinite(n)&&n>0&&n<=5000))return status('Introduce un nombre y dimensiones válidas entre 1 y 5000 mm.');const id=nextBedId++;beds.push({id,name,x,y,z,items:[],placements:{}});activeBed=id;dirty=true;$('bedForm').hidden=true;refreshBeds();status(`Cama creada: ${name}`)};
$('deleteBed').onclick=()=>{if(beds.length===1)return status('Debe conservarse al menos una cama.');const b=getBed();if(b.items.length&&!confirm(`¿Eliminar ${b.name}? Sus ${b.items.length} pieza(s) quedarán sin cama asignada.`))return;beds=beds.filter(v=>v!==b);activeBed=beds[0].id;dirty=true;updateList();refreshBeds();status('Cama eliminada. Las mallas siguen presentes en el proyecto.')};
$('assignBed').onclick=()=>{if(!selected)return status('Selecciona primero una pieza en el visor o lista.');const b=getBed();beds.forEach(v=>{v.items=v.items.filter(id=>id!==selected.uuid);delete v.placements[selected.uuid]});b.items.push(selected.uuid);b.placements[selected.uuid]={x:0,y:0,rot:0};dirty=true;layoutBed();updateList();refreshBeds();status(`«${selected.name}» enviada a ${b.name}.`)};
$('autoLayout').onclick=layoutBed;
$('exportBed').onclick=()=>{const b=getBed();if(!b.items.length)return status('Esta cama no tiene piezas.');const exporter=new STLExporter();let count=0;for(const id of b.items){const m=meshes.find(v=>v.uuid===id);if(!m)continue;try{const placed=makePlacedMesh(m,b.placements[id]||{x:0,y:0,rot:0});download(exporter.parse(placed,{binary:true}),`${b.name}_${String(++count).padStart(2,'0')}_${m.name}`.replace(/[^a-zA-Z0-9_-]/g,'_')+'.stl','model/stl')}catch(e){status('Error exportando '+m.name+': '+e.message);return}}status(`${count} STL descargados por separado de ${b.name}. Comprueba la descarga múltiple en tu navegador.`)};
$('exportBedsReport').onclick=()=>{let lines=['BISTURÍ 3D — INFORME DE CAMAS','Proyecto: '+$('projectName').value,'Comprobación aproximada de cajas envolventes, no validación geométrica', ''];for(const b of beds){lines.push(`${b.name} (${b.x} x ${b.y} x ${b.z} mm)`);for(const id of b.items){const m=meshes.find(v=>v.uuid===id);if(!m)continue;const r=rectangleFor(b,m);lines.push(`  ${m.name}: ${r.w.toFixed(1)} x ${r.h.toFixed(1)} x ${r.z.toFixed(1)} mm | Posición en cama X:${r.x.toFixed(1)} Y:${r.y.toFixed(1)} | Giro:${Number(b.placements[id]?.rot||0)}°`)}const warnings=getProblems(b);lines.push(...(warnings.length?warnings.map(x=>'  ADVERTENCIA: '+x):['  Sin solapamientos aproximados detectados']),'')}lines.push('AVISO: Se exportan STL de mallas existentes. La posición y rotación en cama se incluyen en los STL exportados desde la sección de camas. STL no conserva información de impresora, materiales ni cama como proyecto de laminador.');download(lines.join('\n'),'informe_camas_bisturi3d.txt','text/plain;charset=utf-8')};

// Vista tridimensional de camas: geometrías existentes sin segmentación ni reparación de mallas.
function makePlacedMesh(m,place={x:0,y:0,rot:0}){
  m.updateWorldMatrix(true,false);
  const holder=new THREE.Group(),copy=m.clone(false);
  copy.matrixAutoUpdate=false;copy.matrix.copy(m.matrixWorld);copy.matrixWorldNeedsUpdate=true;
  holder.add(copy);holder.rotation.y=(Number(place.rot)||0)*Math.PI/180;
  holder.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(holder);
  holder.position.set((Number(place.x)||0)-box.min.x,-box.min.y,(Number(place.y)||0)-box.min.z);
  holder.updateMatrixWorld(true);return holder;
}
function updateBedStage(){
  bedStage.clear();stagePick.clear();if(!bedMode)return;
  const b=getBed();if(!b)return;
  const plate=new THREE.Mesh(new THREE.BoxGeometry(b.x,1.2,b.y),new THREE.MeshStandardMaterial({color:0x183951,transparent:true,opacity:.85,roughness:.8}));
  plate.position.set(b.x/2,-1,b.y/2);bedStage.add(plate);
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(b.x,1.2,b.y)),new THREE.LineBasicMaterial({color:0x63d6ff}));edges.position.copy(plate.position);bedStage.add(edges);
  const gridlines=new THREE.Group(),lineMat=new THREE.LineBasicMaterial({color:0x36617c,transparent:true,opacity:.7});
  const step=Math.max(10,Math.round(Math.max(b.x,b.y)/12/10)*10);
  for(let x=0;x<=b.x;x+=step){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,0,0),new THREE.Vector3(x,0,b.y)]),lineMat);gridlines.add(l)}
  for(let y=0;y<=b.y;y+=step){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,y),new THREE.Vector3(b.x,0,y)]),lineMat);gridlines.add(l)}bedStage.add(gridlines);
  for(const id of b.items){const m=meshes.find(v=>v.uuid===id);if(!m)continue;const holder=makePlacedMesh(m,b.placements[id]);holder.traverse(obj=>{if(obj.isMesh){obj.material=obj.material?.clone?obj.material.clone():obj.material;stagePick.set(obj,m)}});bedStage.add(holder)}
}
function fitBed(){const b=getBed();if(!b)return;const center=new THREE.Vector3(b.x/2,0,b.y/2),d=Math.max(b.x,b.y,b.z)*1.8;orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(d*.75,d*.9,d*.75));camera.near=.01;camera.far=d*30;camera.updateProjectionMatrix();orbit.update()}
function enterBed(){if(!modelLoaded)return status('Importa un modelo primero.');bedMode=true;root.visible=false;grid.visible=false;bedStage.visible=true;transform.detach();$('viewBed3D').classList.add('active');$('viewBed3D').textContent='Volver al modelo';updateBedStage();fitBed();status('Cama 3D: arrastra una pieza para colocarla. El giro se define en el panel de camas.')}
function leaveBed(){if(!bedMode)return;bedMode=false;dragBed=null;orbit.enabled=true;bedStage.clear();bedStage.visible=false;root.visible=true;grid.visible=true;$('viewBed3D').classList.remove('active');$('viewBed3D').textContent='Ver cama 3D';}
function bedPointer(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const out=new THREE.Vector3();return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),out)?{x:out.x,y:out.z}:null}
function syncPlacementFields(){const b=getBed();const p=b&&selected&&b.placements[selected.uuid];for(const [key,id] of [['x','placeX'],['y','placeY'],['rot','placeRot']]){$(id).disabled=!p;if(p)$(id).value=Number(p[key]||0).toFixed(key==='rot'?0:1)}}
$('viewBed3D').onclick=()=>{if(bedMode){leaveBed();fit();status('Vista del modelo restaurada.')}else enterBed()};
$('centerBedView').onclick=()=>{if(!bedMode)enterBed();else fitBed()};
$('applyPlace').onclick=()=>{const b=getBed(),p=selected&&b.placements[selected.uuid];if(!p)return status('Selecciona una pieza que pertenezca a la cama activa.');const x=Number($('placeX').value),y=Number($('placeY').value),rot=Number($('placeRot').value);if(![x,y,rot].every(Number.isFinite))return status('Valores de posición o giro no válidos.');Object.assign(p,{x,y,rot});dirty=true;drawBed();updateBedStage();status(getProblems(b).length?'Posición actualizada: revisa las advertencias.':'Posición y giro actualizados.');};
$('exportPlacedBed').onclick=()=>{const b=getBed();if(!b.items.length)return status('La cama no tiene piezas.');try{const group=new THREE.Group();for(const id of b.items){const m=meshes.find(v=>v.uuid===id);if(m)group.add(makePlacedMesh(m,b.placements[id]))}group.updateMatrixWorld(true);download(new STLExporter().parse(group,{binary:true}),b.name.replace(/[^a-zA-Z0-9_-]/g,'_')+'_colocada.stl','model/stl');status('Cama exportada como STL conjunto con posiciones y giros. Comprueba los avisos y verifica en tu laminador.')}catch(e){status('No se pudo exportar la cama: '+e.message)}};

// Archivo de proyecto local: contiene geometría, materiales, transformaciones y camas.
// No usa servidores, localStorage ni almacenamiento automático.
function projectDocument(){
  if(!modelLoaded)throw new Error('Primero carga un modelo.');
  if(xray)throw new Error('Desactiva Rayos X antes de guardar para conservar los materiales originales.');
  transform.detach();root.updateMatrixWorld(true);
  return {
    format:'Bisturi3DProject',version:1,
    created:new Date().toISOString(),
    name:$('projectName').value.trim()||'Proyecto',
    height:$('height').value,nozzle:$('nozzle').value,mode,
    geometry:root.toJSON(),
    beds:beds.map(b=>({id:b.id,name:b.name,x:b.x,y:b.y,z:b.z,
      items:[...b.items],placements:Object.fromEntries(Object.entries(b.placements).map(([id,p])=>[id,{x:p.x,y:p.y,rot:p.rot}]))})),
    activeBed,selectedId:selected?.uuid||null,
    note:'Las piezas indicadas son mallas existentes; este archivo no implica cortes ni reparación geométrica.'
  };
}
function safeProjectName(name){return(name||'proyecto').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,70)||'proyecto'}
$('saveProjectBtn').onclick=()=>{
  try{
    const doc=projectDocument();
    const json=JSON.stringify(doc);
    const size=new Blob([json]).size;
    if(size>80*1024*1024&&!confirm(`El proyecto pesa ${(size/1024/1024).toFixed(1)} MB y puede ser difícil de descargar en este teléfono. ¿Continuar?`))return;
    download(json,safeProjectName(doc.name)+'.bisturi3d.json','application/json');
    dirty=false;status(`Proyecto descargado (${(size/1024/1024).toFixed(1)} MB). Guarda el archivo: no hay copia automática.`);
  }catch(e){status('No se pudo guardar el proyecto: '+e.message)}
};
$('openProjectBtn').onclick=()=>$('projectFile').click();
$('projectFile').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  if(dirty&&!confirm('Abrir otro proyecto descartará el trabajo actual en memoria. ¿Continuar?'))return;
  try{
    if(file.size>250*1024*1024)throw Error('El archivo es demasiado grande para esta versión (máximo 250 MB).');
    const doc=JSON.parse(await file.text());
    if(doc?.format!=='Bisturi3DProject'||doc.version!==1||!doc.geometry?.object)throw Error('Formato o versión de proyecto no compatible.');
    if(!Array.isArray(doc.beds)||doc.beds.length<1||doc.beds.length>100)throw Error('La información de las camas es inválida.');
    const object=new THREE.ObjectLoader().parse(doc.geometry);
    if(!object?.isObject3D)throw Error('El proyecto no contiene una escena válida.');
    prepare(object,String(doc.name||'Proyecto recuperado').slice(0,100));
    $('height').value=String(doc.height||'');
    if(['0.2','0.4','0.6','0.8'].includes(String(doc.nozzle)))$('nozzle').value=String(doc.nozzle);
    if(['Automático','Manual','Mixto'].includes(doc.mode)){
      mode=doc.mode;document.querySelectorAll('.mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    }
    const ids=new Set(meshes.map(m=>m.uuid));
    beds=doc.beds.map((b,i)=>({
      id:Number.isSafeInteger(b.id)?b.id:i+1,
      name:String(b.name||`Cama ${i+1}`).slice(0,60),
      x:Number(b.x)>0&&Number(b.x)<=5000?Number(b.x):256,
      y:Number(b.y)>0&&Number(b.y)<=5000?Number(b.y):256,
      z:Number(b.z)>0&&Number(b.z)<=5000?Number(b.z):256,
      items:[...new Set((Array.isArray(b.items)?b.items:[]).filter(id=>ids.has(id)))],
      placements:Object.fromEntries(Object.entries(b.placements||{}).filter(([id,v])=>ids.has(id)&&v&&[v.x,v.y,v.rot].every(n=>Number.isFinite(Number(n)))).map(([id,v])=>[id,{x:Number(v.x),y:Number(v.y),rot:Number(v.rot)}]))
    }));
    // Una malla solo puede estar asignada a una cama.
    const assigned=new Set();for(const b of beds){b.items=b.items.filter(id=>{if(assigned.has(id))return false;assigned.add(id);return true})}
    nextBedId=Math.max(...beds.map(b=>b.id),0)+1;
    activeBed=beds.some(b=>b.id===doc.activeBed)?doc.activeBed:beds[0].id;
    selected=meshes.find(m=>m.uuid===doc.selectedId)||null;
    refreshBeds();updateList();updateStats();fit();dirty=false;
    status(`Proyecto recuperado: ${meshes.length} mallas y ${beds.length} camas. Revisa colores y materiales importados.`);
  }catch(error){console.error(error);status('No se pudo recuperar el proyecto: '+error.message)}
};

refreshBeds();

function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;if(w&&h){camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}}new ResizeObserver(resize).observe(viewport);resize();renderer.setAnimationLoop(()=>{orbit.update();renderer.render(scene,camera)});
