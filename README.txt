BISTURÍ 3D — PRIMERA VERSIÓN FUNCIONAL

ARCHIVOS
index.html
styles.css
app.js
manifest.webmanifest

INSTALACIÓN EN GITHUB PAGES
1. Crear un repositorio NUEVO e independiente, por ejemplo bisturi-3d.
2. Subir los cuatro archivos a la raíz del repositorio.
3. Settings > Pages > Deploy from a branch > main > /(root).
4. Abrir la dirección de GitHub Pages que aparezca al finalizar el despliegue.

IMPORTANTE
- La aplicación usa módulos de Three.js desde esm.sh. Requiere conexión a internet para cargar las librerías, aunque los modelos se procesan localmente en el navegador.
- El usuario no envía modelos a ningún servidor de la aplicación.
- STL/OBJ/GLB/FBX/3MF se importan en condiciones básicas; OBJ con MTL y texturas externas, y algunas variantes de 3MF/FBX, necesitan ampliación.
- La selección corresponde a objetos de malla importados, NO a regiones geométricas detectadas.
- La exportación STL descarga una malla existente, sin efectuar cortes, reparaciones ni encastres.
- Las dimensiones se asumen en milímetros cuando se aplica altura, ya que no todos los formatos tienen unidades explícitas.
- El modo Mixto/Automático/Manual es una interfaz preparatoria, sin algoritmo de segmentación todavía.
- Los controles de movimiento y la vista explotada son experimentales.
- Esta entrega NO incluye aún el icono oficial ni el encabezado gráfico aprobado, porque se requieren los archivos originales exactos para incorporarlos sin alteraciones.
