# Phoenix Overlay

Overlay de **Phoenix Link** para ver información encima del juego sin estorbar.
Es un fork de [Smash Glass](https://github.com/trybuchet/smash-glass) (de MickeyUK / Smash Soda), rediseñado para partidos de fútbol.
El archivo se llama `PhoenixGlass.exe` y Phoenix Link lo busca en `overlay\` (si solo encuentra el nombre antiguo `SmashGlass.exe`, también lo usa).

## Qué muestra (y qué no)

| Widget | Qué hace | Cuándo se ve |
|---|---|---|
| **Ping de la sala** | Ping de cada invitado. Verde hasta 50 ms, naranja de 50 a 120, rojo de 120 para arriba | Si todos van bien, es un solo punto con el ping medio. La lista se abre sola si alguien pasa de 50 ms o si entra/sale gente |
| **Avisos de chat** | Mensajes de la sala y del chat general de la liga (etiqueta GENERAL) | Aparecen unos segundos y se apagan solos |
| **Última hora** | Noticias de la liga (las publica el staff en la web) | Asoma 9 s al llegar y luego cada 90 s; las urgentes se quedan |
| Mandos | Los mandos virtuales | Apagado por defecto |

Atajos (los de siempre): `Ctrl+Alt+C` chat · `Ctrl+Alt+M` mover widgets · `Ctrl+Alt+F1` menú.

## Compilar

1. Doble clic en `COMPILAR_OVERLAY.bat` (instala Go si falta).
2. Copia `bin\PhoenixGlass.exe` a la carpeta `overlay` de Phoenix Link.

Si cambias la parte visual (`frontend/`): `cd frontend`, `npm ci`, `npm run build` y vuelve a compilar. La carpeta `frontend/dist` va incluida en el repositorio para que compilar solo necesite Go.

## Vista previa en el navegador (sin Phoenix Link)

`cd frontend && npx vite --config vite.preview.config.ts` y abre `http://127.0.0.1:8767/preview/index.html?esc=todo` (también `esc=ok` y `esc=lag`).

## Eventos nuevos por WebSocket (los manda Phoenix Link)

- `phoenix:ticker` → `{ items: [{ id, texto, nivel: info|importante|urgente }] }`
- `phoenix:chatgeneral` → `{ id, nombre, texto }`

## Licencia

El proyecto original no incluye archivo de licencia. Se conserva el crédito a MickeyUK y a los autores de Smash Glass.
