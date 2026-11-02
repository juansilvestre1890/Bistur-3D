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


ACTUALIZACIÓN — CAMAS MÚLTIPLES
Puedes crear camas personalizadas, asignar piezas a la cama elegida, distribuirlas en un esquema superior y obtener advertencias aproximadas por límites y solapamiento. Se puede descargar por separado un STL de cada malla asignada y un informe de camas.
IMPORTANTE: la vista superior es una planificación 2D. Las posiciones de la cama NO quedan incorporadas en los STL exportados; tampoco sustituye la organización precisa ni la validación de un laminador. No hay almacenamiento permanente.
Para actualizar GitHub Pages: sustituye index.html, app.js, styles.css y README.txt en la raíz del repositorio Bistur-3D. Conserva manifest.webmanifest.

ACTUALIZACIÓN: VISTA 3D DE CAMAS
- Ver cama 3D activa una escena de trabajo con las mallas asignadas.
- Toca y arrastra una pieza sobre la cama o ajusta X, Y y giro en el panel.
- Exportar cama colocada genera un STL conjunto con posiciones y giros aplicados; no es 3MF ni proyecto nativo de laminador.
- Exportar STLs de cama genera archivos STL posicionados por pieza. En Safari, múltiples descargas pueden requerir permisos.
- Las comprobaciones usan cajas envolventes aproximadas, sin validar malla manifold, separación ni encastres.
- Cama y disposiciones solo viven en memoria; recargar pierde el trabajo.


PROYECTOS LOCALES (ARCHIVO .bisturi3d.json)
- Guardar proyecto descarga un archivo JSON con geometría, materiales, posiciones y camas.
- Recuperar proyecto abre ese archivo desde el dispositivo y restaura las camas y las mallas.
- No hay autosave, cuenta ni subida a servidores. Conserva el archivo de proyecto.
- Las texturas externas de algunos formatos podrían no conservarse correctamente; revisa el modelo tras recuperarlo.
- Un proyecto complejo puede resultar muy pesado en dispositivos móviles.
- Los cortes y encastres geométricos reales siguen pendientes.

ACTUALIZACIÓN ACUMULADA — CORTE HORIZONTAL EXPERIMENTAL
- Selecciona una sola malla, establece el porcentaje de altura (1–99) y pulsa «Cortar malla por plano horizontal».
- El algoritmo corta triángulos y reconstruye la tapa plana cuando detecta un único contorno cerrado simple.
- Produce dos nuevas mallas, superior e inferior, seleccionables y exportables como STL.
- Atrás / Ctrl+Z restaura la malla previa al corte; Rehacer recupera el resultado.
- Las dos mallas nuevas quedan SIN cama asignada para permitir distribuirlas por separado.
- Rechaza superficies abiertas/no-manifold y varios contornos de intersección, incluidas posibles cavidades; no se garantizan resultados imprimibles en mallas defectuosas.
- No soporta todavía cortes oblicuos, seguimiento magnético, selección con pincel ni encastres.
- NO PROBADO en Safari ni validado con pruebas de estanqueidad en modelos reales; es una primera implementación experimental.
- Archivo nuevo obligatorio en el mismo directorio que app.js: plane-cut.js.


ACTUALIZACIÓN ACUMULADA — PLANOS VERTICALES E INCLINADOS
- En Herramientas, selecciona Horizontal Y, Vertical X, Vertical Z o Inclinado.
- Para Inclinado, introduce ángulos X y Z (en grados).
- El porcentaje se mide desde el extremo negativo al positivo de la proyección de la malla según la normal del plano.
- Se transforma la malla a un sistema alineado con el plano, se secciona y las dos partes regresan al sistema local original.
- Atrás/Deshacer y Rehacer recuperan las piezas del corte.
- Cortes en geometría abierta, con múltiples bucles, cavidades o contornos complicados pueden ser rechazados.
- No se ha validado en modelos reales ni se garantizan piezas imprimibles. No incluye todavía pincel, varita ni encastres.
- No instalar este paquete de desarrollo hasta completar las pruebas y la versión consolidada.


ENCASTRES CILÍNDRICOS (EXPERIMENTAL)
- Realiza un corte de plano sobre una malla sencilla y selecciona una de las mitades.
- Introduce diámetro, profundidad y holgura radial y pulsa Agregar pasador y alojamiento.
- El software intenta fusionar el pasador con la mitad positiva y sustraer un
  alojamiento de la mitad negativa con CSG (three-bvh-csg).
- La ubicación inicial se calcula en un triángulo interior del área de corte;
  aún no hay posicionamiento manual ni múltiples pasadores por corte.
- Las mallas CSG pueden resultar no manifold. Debes verificarlas y repararlas
  en el laminador antes de imprimir. No se garantiza compatibilidad con todos
  los modelos, ni un ajuste físico preciso sin pruebas de tolerancia.
- Necesita internet para descargar la biblioteca adicional durante el uso.
- Atrás / Ctrl+Z recupera la versión previa de las dos piezas en la sesión.
- No sustituir los archivos actuales de GitHub antes de probar la versión
  consolidada que se entregará más adelante.
