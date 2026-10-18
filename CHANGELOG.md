# Historial de versiones

## 1.2.0 · Progreso y ejercicios
- **Ejercicios** (pestaña nueva): catálogo completo con foto de referencia, agrupado por músculo.
  Búsqueda por nombre, músculo o equipo; filtros por enfoque (tren superior, tren inferior, core, cardio),
  por equipo y "Los que hago".
- **Ficha de cada ejercicio**: animación inicio ⇄ final, músculos que trabaja, equipo, tu mejor serie,
  gráfico de evolución (1RM estimado, lastre, tiempo o duración según el ejercicio) y últimas sesiones.
  Desde la ficha puedes agregarlo a la sesión en curso o a una plantilla.
- **Progreso** (reemplaza Historial): sesiones por semana (12 semanas), semanas seguidas,
  series de la semana por grupo muscular, récords de los últimos 30 días y la tendencia de cada ejercicio.
  El historial de sesiones queda en Progreso → Sesiones.
- **Récords**: al terminar una sesión la app avisa si superaste tu mejor marca y la marca con un trofeo.
- En la sesión, cada ejercicio muestra su foto; tócala para abrir la ficha.
- Cuenta pasa al botón redondo de arriba a la derecha.
- Corregido: la sesión recién terminada no se abría en el historial hasta que respondía Firestore.
- Corregido: faltaba la carpeta de íconos.
- Imágenes: Free Exercise DB (github.com/yuhonas/free-exercise-db), dominio público.

## 1.1.0 · Primera versión fuera de Claude
- Inicio de sesión con correo y contraseña (Firebase Authentication).
- Plantillas reutilizables y semana asignable.
- Datos en Cloud Firestore con modo sin conexión; app instalable (PWA).
