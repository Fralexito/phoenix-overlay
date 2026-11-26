# Cómo trabajamos en este repositorio

Reglas comunes a todos los repos de Phoenix. Cortas a propósito.

## Ramas
- `main` es la rama estable. En `phoenixevolution` el trabajo va en `borrador` y pasa a `main` solo con la orden «Súbelo» o «Publícalo» de Frank.
- Una rama por tema, con nombre que diga qué es: `feat/…`, `fix/…`, `docs/…`, `chore/…`. Las ramas `claude/project-thread-*` que crea la herramienta de Claude se aceptan, pero el PR debe llevar un título claro.
- Nada de `push --force` en ramas compartidas. Nada se borra sin pasar por Frank.

## Pull requests
- Uno por tema, pequeño, en **borrador** hasta que esté probado. Título: `tipo(área): resumen en español`.
- Cuenta qué cambia, cómo se probó y qué NO se probó (por ejemplo «no compilado en Windows»). Usa la plantilla.
- La base del PR es `main` (o `borrador` en la web). No apilar PRs sobre otros PRs salvo que se avise en el título.

## Versiones
- Versión visible `MAYOR.MENOR.PARCHE`. Cada versión: línea en `CHANGELOG.md` y etiqueta git `vX.Y.Z`.

## Seguridad (no negociable)
- Nunca subir contraseñas, claves, tokens, `config.json` reales, `vinculos.json`, bases `.db`, `*.bin` de claves, capturas ni respaldos. Se sube solo el `*.ejemplo.*`.
- Binarios (`.dll`, `.exe`, `.zip`) fuera de git, salvo dependencias documentadas en el README.
- Si una clave se subió por error: avisar a Frank, rotarla y limpiar el historial. Borrar el archivo no basta.

## Antes de abrir el PR
- Correr las pruebas del repo (ver su README) y dejarlas en 0 fallos.
- Respetar el estilo del repo y la regla de Frank: nombres siempre «Phoenix» en inglés; texto de usuario en español simple.

## Dos cuentas de Claude
Antes de empezar y al terminar, leer y actualizar el repo `phoenix-traspaso` (REGLAS, ESTADO, CANDADOS y `registro/`). Un frente = una cuenta a la vez.
