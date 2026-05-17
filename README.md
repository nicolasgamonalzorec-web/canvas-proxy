# Canvas Proxy Server

Servidor proxy Node.js que actúa como intermediario entre el artifact de Cowork y la API de Canvas para evitar problemas de CORS.

## ¿Por qué necesitamos esto?

Canvas LMS no permite peticiones CORS desde dominios desconocidos. El artifact se ejecuta desde un dominio de Cowork/Anthropic, así que las peticiones directas a Canvas fallan. Este proxy soluciona eso.

## Arquitectura

```
Artifact en Cowork
    ↓
    HTTP GET /api/dashboard
    ↓
Canvas Proxy Server (Vercel)
    ↓
    Bearer Token + Canvas API
    ↓
Canvas LMS (uandes.instructure.com)
    ↓
    Datos JSON
    ↓
Artifact (renderiza dashboard)
```

## Endpoints

- `GET /` - Información del proxy
- `GET /api/health` - Health check
- `GET /api/dashboard` - Obtiene TODOS los datos (cursos, calificaciones, asignaciones)
- `GET /api/course/:courseId` - Obtiene datos de un curso específico

## Deployment en Vercel

1. Crear cuenta en Vercel (gratis)
2. Conectar el repo de GitHub
3. Vercel deployará automáticamente
4. El proxy estará disponible en: https://canvas-proxy-[randomid].vercel.app

## Características

- **Cache inteligente**: Almacena datos por 1 hora para no saturar Canvas
- **Logging**: Registra cada petición para debuggear
- **CORS habilitado**: Acepta peticiones desde cualquier origen
- **Error handling**: Maneja errores de Canvas gracefully
- **Health check**: Monitorea que el proxy esté funcionando

## Variables de entorno

En Vercel, configurar:
- `CANVAS_TOKEN`: Tu token de Canvas (ya está en el código para testing)

## Testing local

```bash
npm install
npm run dev
```

Luego en otro terminal:
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/dashboard
```
