# CardHelper - Test Psicologia

Aplicacion de practica tipo test basada en apuntes locales.

## Requisitos

- Node.js 20+
- npm 10+

## Instalacion

```bash
npm install
```

## Banco de preguntas

El banco ya está incluido en `src/data/questionBank.json` y contiene 300 preguntas, 30 por tema.

La fuente única sigue siendo `Diseños-de-investigación.txt`.

## Ejecutar en local

```bash
npm run dev
```

URL por defecto:

- `http://localhost:5173/`

## Build de produccion

```bash
npm run build
npm run preview
```

## Modos disponibles

1. Modo Examen
- 30 preguntas
- seleccion aleatoria o balanceada por temas
- temporizador personalizable (solo en este modo)
- correccion al final con explicacion

2. Modo Practica inmediata
- respondes y corriges al instante
- explicacion inmediata

3. Modo Practica por tema
- eliges tema
- practica con feedback inmediato

## PDFs

Desde el menu principal se pueden generar:

1. PDF solo preguntas
2. PDF con respuestas correctas y explicacion breve

Ambos PDFs usan el mismo conjunto de preguntas congelado para la sesion actual.

## Despliegue web

La app queda lista para desplegar como sitio estático tras `npm run build`.
