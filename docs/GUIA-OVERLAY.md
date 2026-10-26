# Guía del Overlay de Phoenix (PhoenixGlass) — cómo funciona, cómo se compila y qué datos recibe

Última actualización: 26-oct-2026. Una sola guía larga por tema (regla de Fralex); se amplía, no se duplica.

## 1. Qué es
Unos cuadros transparentes que se dibujan encima de PES 2021 (ping, chat, noticias, avisos de gol y de torneo, panel de amigos). Es el programa `PhoenixGlass.exe` (Go + Wails 3 + Vue). Fork de Smash Glass.
No estorba: ventana transparente, sin marco, siempre encima y con **IgnoreMouseEvents = true** (el mouse y teclado pasan al juego). Solo captura el mouse al abrir el menú (Ctrl+Alt+F1) o el panel de amigos. Todo lo que aparece se apaga solo.

## 2. Cómo funciona
El overlay no sabe nada por sí solo. **Phoenix Link** lo abre y le manda datos por un WebSocket local (`ws://localhost:9002`); el overlay solo dibuja. Eventos (bus `$eventBus`, en `frontend/src/stores/overlayStore.ts`):
- `guest:poll` → ping de invitados. `chat:new` / `chat:log` → chat de sala.
- `phoenix:ticker` → `{items:[{id,texto,nivel}]}` noticias. `phoenix:chatgeneral` → `{id,nombre,texto}`.
- `phoenix:partido` → marcador del juego: `{fase,minuto,segundo,anadido,periodo,reloj,local:{nombre,goles},visita:{nombre,goles},goles:[{m,l,j,pp}]}` (`fase:'libre'` = nada). **No se dibuja fijo** (decisión de Fralex: PES ya tiene marcador).
- `phoenix:torneo` → `{torneo,ronda,a,b}` (Link 0.3.50; viene de `GET /v1/torneos/partidos`). Link manda `null` al limpiar, elegir liga o terminar el partido, y lo **reenvía cada 5 s**.
- `phoenix:amigos`, `phoenix:invitacion` → panel de amigos.

## 3. Lo nuevo (25-oct-2026, PR #1)
`frontend/src/components/overlay/widgets/PhoenixPartidoAvisoView.vue`:
- Cartel «¡GOOOL!» 7 s por cada gol nuevo (equipo, goleador, minuto, marcador).
- Cinta de torneo «Torneo · Ronda / A vs B»: 8 s al empezar el partido y 10 s con el resultado final (`fase:'final'`).
- Nada fijo en pantalla.
Errores encontrados y corregidos: (1) como Link reenvía `phoenix:torneo` cada 5 s, la cinta habría reaparecido cada 5 s → el store ahora ignora el reenvío si los datos no cambiaron. (2) `pkill -f vite` mató la propia terminal al probar; no repetir.

## 4. Compilar (se puede hacer en la nube, sin tocar la PC)
- Visual: `cd frontend && npm ci && npm run build` (la carpeta `frontend/dist` va en el repo).
- Exe de Windows desde Linux: `CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -buildvcs=false -ldflags="-w -s -H windowsgui" -o bin/PhoenixGlass.exe .` (Go 1.24; sin icono, el .bat de Windows sí lo incrusta). Copia en `/mnt/project-files/overlay/PhoenixGlass.exe`.
- En la PC: `COMPILAR_OVERLAY.bat` y copiar a la carpeta `overlay` de Phoenix Link. No usar COMPILAR_PHOENIX.bat (es de Link).

## 5. Ver sin Phoenix Link
- Vista previa: `cd frontend && npx vite --config vite.preview.config.ts` → `http://127.0.0.1:8767/preview/index.html?esc=todo` (también `ok`, `lag`, `futbol&gol=1&torneo=1&panel=1`).
- Demo publicada (datos simulados): https://claude.ai/artifact/UMq3HCxcpucRk1z2byDSPC

## 6. Pendiente
- **Prueba real** con sala abierta en la PC de Fralex (Link 0.3.50 + este exe): vincular cuenta > PARTIDO > TORNEO. Usar el MCP phoenix-pes (D:\Frank\IA\CLAUDE\pes-mcp) para todo lo de PES.
- Copiar el exe a la carpeta `overlay` de Link (coordinar con el hilo 1; no tocar Link).
- Ideas: cartel de penales / tarjeta roja si Link lee esos eventos; cinta con la tabla del torneo.
