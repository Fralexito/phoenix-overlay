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

REM Sin wails3: el icono y el manifiesto se incrustan con rsrc (se descarga solo; si falla, compila igual sin icono)
if not exist wails_windows_amd64.syso (
  go run github.com/akavel/rsrc@v0.10.2 -arch amd64 -ico build\windows\icon.ico -manifest build\windows\wails.exe.manifest -o rsrc_windows_amd64.syso >nul 2>nul
)

go build -trimpath -buildvcs=false -ldflags="-w -s -H windowsgui" -o bin\PhoenixGlass.exe .
if errorlevel 1 (
  echo.
  echo  ERROR al compilar. Copia lo que dice arriba y mandaselo a Claude.
  del /q *.syso >nul 2>nul
  pause
  exit /b 1
)
del /q *.syso >nul 2>nul

echo.
echo  Listo: %~dp0bin\PhoenixGlass.exe
echo.
echo  Para usarlo con Phoenix Link, copialo a la carpeta "overlay" del programa
echo  ^(donde esta PhoenixLink.exe^). El archivo se llama PhoenixGlass.exe.
echo.
pause
