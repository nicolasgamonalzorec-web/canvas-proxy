const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// Configuración
const CANVAS_TOKEN = '9374~rRXPJtTTBkt3TBmDQ3VtL37TFQzBNKrtEkG7HWuJTTH9xkvQLfteRtRwezxW7cRA';
const CANVAS_BASE_URL = 'https://uandes.instructure.com/api/v1';
const COURSE_IDS = [43224, 43233, 43851, 13339, 44585, 44612, 44045, 44849, 43450];

// Middleware
app.use(cors());
app.use(express.json());

// Cache simple (reinicia cada hora)
let dataCache = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 3600000; // 1 hora

// Headers para las peticiones a Canvas
const canvasHeaders = {
  'Authorization': `Bearer ${CANVAS_TOKEN}`,
  'Content-Type': 'application/json'
};

// Endpoint: obtener todos los datos (cursos, calificaciones, tareas)
app.get('/api/dashboard', async (req, res) => {
  try {
    // Verificar si el cache sigue siendo válido
    const now = Date.now();
    if (dataCache.all && (now - cacheTimestamp) < CACHE_DURATION) {
      return res.json({
        success: true,
        data: dataCache.all,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Obtener nombres de cursos
    console.log('[Canvas Proxy] Fetching courses...');
    const coursesResponse = await fetch(`${CANVAS_BASE_URL}/courses?enrollment_state=active`, {
      headers: canvasHeaders
    });
    
    if (!coursesResponse.ok) {
      throw new Error(`Canvas API error: ${coursesResponse.status}`);
    }
    
    const courses = await coursesResponse.json();
    const courseMap = {};
    courses.forEach(c => courseMap[c.id] = c.name);

    // Obtener calificaciones
    console.log('[Canvas Proxy] Fetching grades...');
    const gradesData = {};
    for (const courseId of COURSE_IDS) {
      try {
        const response = await fetch(`${CANVAS_BASE_URL}/courses/${courseId}/enrollments?user_id=self`, {
          headers: canvasHeaders
        });
        const enrollments = await response.json();
        if (enrollments && enrollments[0] && enrollments[0].grades) {
          gradesData[courseId] = enrollments[0].grades;
        }
      } catch (e) {
        console.error(`Error fetching grades for course ${courseId}:`, e.message);
      }
    }

    // Obtener asignaciones próximas
    console.log('[Canvas Proxy] Fetching assignments...');
    const assignmentsData = {};
    for (const courseId of COURSE_IDS) {
      try {
        const response = await fetch(`${CANVAS_BASE_URL}/courses/${courseId}/assignments?include=submission&order_by=due_at`, {
          headers: canvasHeaders
        });
        const assignments = await response.json();
        const now = new Date();
        const upcoming = assignments
          .filter(a => a.due_at && new Date(a.due_at) > now)
          .slice(0, 2)
          .map(a => ({
            name: a.name,
            due_at: a.due_at,
            submission_types: a.submission_types
          }));
        if (upcoming.length > 0) assignmentsData[courseId] = upcoming;
      } catch (e) {
        console.error(`Error fetching assignments for course ${courseId}:`, e.message);
      }
    }

    const result = {
      courseMap,
      gradesData,
      assignmentsData,
      courseIds: COURSE_IDS
    };

    // Guardar en cache
    dataCache.all = result;
    cacheTimestamp = now;

    res.json({
      success: true,
      data: result,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Canvas Proxy] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint: obtener un curso específico
app.get('/api/course/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const response = await fetch(`${CANVAS_BASE_URL}/courses/${courseId}/enrollments?user_id=self`, {
      headers: canvasHeaders
    });
    
    if (!response.ok) {
      throw new Error(`Canvas API error: ${response.status}`);
    }
    
    const enrollments = await response.json();
    
    res.json({
      success: true,
      data: enrollments,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Canvas Proxy] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint: health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'proxy is running',
    timestamp: new Date().toISOString()
  });
});

// Endpoint raíz
app.get('/', (req, res) => {
  res.json({
    name: 'Canvas Proxy Server',
    version: '1.0.0',
    description: 'Proxy for Canvas LMS API to bypass CORS restrictions',
    endpoints: {
      '/api/health': 'Health check',
      '/api/dashboard': 'Get all dashboard data (courses, grades, assignments)',
      '/api/course/:courseId': 'Get specific course data'
    }
  });
});

// Error 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Canvas Proxy] Server running on port ${PORT}`);
  console.log(`[Canvas Proxy] Canvas token configured: ${CANVAS_TOKEN.substring(0, 20)}...`);
  console.log(`[Canvas Proxy] Monitoring ${COURSE_IDS.length} courses`);
});

module.exports = app;
