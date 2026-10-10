@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo  === Phoenix Overlay: compilar ===
echo.

where go >nul 2>nul
if errorlevel 1 (
  echo  Falta instalar Go ^(el programa que compila el overlay^).
  echo  Voy a instalarlo ahora con winget. Cuando termine, CIERRA esta ventana
  echo  y vuelve a abrir este mismo archivo.
  echo.
  winget install -e --id GoLang.Go
  pause
  exit /b 1
)

set CGO_ENABLED=0
set GOOS=windows
if not exist bin mkdir bin

REM Icono y manifiesto (opcional: solo si wails3 esta instalado)
where wails3 >nul 2>nul
if not errorlevel 1 (
  wails3 generate syso -arch amd64 -icon build\windows\icon.ico -manifest build\windows\wails.exe.manifest -info build\windows\info.json -out wails_windows_amd64.syso >nul 2>nul
)

go build -trimpath -buildvcs=false -ldflags="-w -s -H windowsgui" -o bin\SmashGlass.exe .
if errorlevel 1 (
  echo.
  echo  ERROR al compilar. Copia lo que dice arriba y mandaselo a Claude.
  del /q *.syso >nul 2>nul
  pause
  exit /b 1
)
del /q *.syso >nul 2>nul

echo.
echo  Listo: %~dp0bin\SmashGlass.exe
echo.
echo  Para usarlo con Phoenix Link, copialo a la carpeta "overlay" del programa
echo  ^(donde esta PhoenixLink.exe^). El nombre debe seguir siendo SmashGlass.exe.
echo.
pause
