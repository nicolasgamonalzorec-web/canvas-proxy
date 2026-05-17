const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración
const CANVAS_TOKEN = '9374~rRXPJtTTBkt3TBmDQ3VtL37TFQzBNKrtEkG7HWuJTTH9xkvQLfteRtRwezxW7cRA';
const CANVAS_BASE_URL = 'https://uandes.instructure.com/api/v1';
const COURSE_IDS = [43224, 43233, 43851, 13339, 44585, 44612, 44045, 44849, 43450];

// Middleware - CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400
}));

// Preflight handler
app.options('*', cors());

// Explicit CORS headers middleware to ensure all responses have CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Max-Age', '86400');
  next();
});

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

// ============================================
// DASHBOARD HTML EMBEBIDO - VERSIÓN 3.0.0
// ============================================
const dashboardHTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Canvas Dashboard - Cowork</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 16px;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            background: white;
            padding: 24px;
            border-radius: 12px;
            margin-bottom: 24px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        .header h1 {
            font-size: 28px;
            margin-bottom: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header p {
            opacity: 0.7;
            font-size: 14px;
            margin-bottom: 16px;
        }

        .controls {
            display: flex;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
        }

        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: transform 0.2s;
        }

        button:hover {
            transform: translateY(-2px);
        }

        button:active {
            transform: translateY(0);
        }

        .courses-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 24px;
        }

        .course-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .course-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }

        .course-name {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 12px;
            color: #333;
        }

        .course-info {
            font-size: 13px;
            opacity: 0.6;
            margin-bottom: 16px;
        }

        .grade-badge {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: 600;
            margin-bottom: 12px;
        }

        .assignments {
            background: #f5f5f5;
            padding: 12px;
            border-radius: 6px;
            font-size: 12px;
            color: #666;
        }

        .loading {
            text-align: center;
            padding: 40px 20px;
            color: #666;
        }

        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
            .courses-grid {
                grid-template-columns: 1fr;
            }

            .header h1 {
                font-size: 22px;
            }

            .controls {
                flex-direction: column;
                width: 100%;
            }

            button {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Canvas Dashboard</h1>
            <p>Tu panel de control de cursos - Accesible desde cualquier dispositivo</p>
            <div class="controls">
                <button onclick="loadData()">🔄 Actualizar</button>
                <button onclick="location.href='/api/dashboard'">📊 Ver JSON</button>
            </div>
        </div>
        <div id="courses-container" class="loading">
            <div class="spinner"></div>
            <p>Cargando tus cursos...</p>
        </div>
    </div>

    <script>
        async function loadData() {
            const container = document.getElementById('courses-container');
            container.innerHTML = '<div class="spinner"></div><p>Cargando...</p>';

            try {
                const response = await fetch('/api/dashboard');
                const data = await response.json();

                if (data.success) {
                    displayCourses(data.data);
                } else {
                    container.innerHTML = '<p style="color: red;">Error al cargar los datos</p>';
                }
            } catch (error) {
                container.innerHTML = '<p style="color: red;">Error de conexión: ' + error.message + '</p>';
            }
        }

        function displayCourses(data) {
            const container = document.getElementById('courses-container');
            const courseMap = data.courseMap || {};
            const gradesData = data.gradesData || {};

            let html = '<div class="courses-grid">';

            for (const [courseId, courseName] of Object.entries(courseMap)) {
                const grades = gradesData[courseId] || {};
                const finalGrade = grades.finalGrade || 'N/A';
                const assignmentCount = grades.assignments ? grades.assignments.length : 0;

                html += `
                    <div class="course-card">
                        <div class="course-name">${courseName}</div>
                        <div class="course-info">ID: ${courseId}</div>
                        <div class="grade-badge">Calificación: ${finalGrade}</div>
                        <div class="assignments">
                            📝 ${assignmentCount} tareas registradas
                        </div>
                    </div>
                `;
            }

            html += '</div>';
            container.innerHTML = html;
        }

        // Cargar datos al iniciar
        loadData();
    </script>
</body>
</html>`;

// ============================================
// ENDPOINT: Servir Dashboard HTML en root
// ============================================
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(dashboardHTML);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'proxy is running',
    timestamp: new Date().toISOString(),
    version: '3.0.0'
  });
});

// Endpoint: obtener todos los datos (cursos, calificaciones, tareas)
app.get('/api/dashboard', async (req, res) => {
  try {
    const now = Date.now();
    if (dataCache.all && (now - cacheTimestamp) < CACHE_DURATION) {
      return res.json({
        success: true,
        data: dataCache.all,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    console.log('[Canvas Proxy] Fetching courses...');
    const coursesResponse = await fetch(`${CANVAS_BASE_URL}/courses?enrollment_state=active`, {
      headers: canvasHeaders
    });

    if (!coursesResponse.ok) {
      throw new Error(`Canvas API error: ${coursesResponse.status}`);
    }

    const courses = await coursesResponse.json();
    const courseMap = {};
    const gradesData = {};
    const assignmentsData = {};

    for (const course of courses) {
      if (COURSE_IDS.includes(course.id)) {
        courseMap[course.id] = course.name;

        const enrollmentsResponse = await fetch(
          `${CANVAS_BASE_URL}/courses/${course.id}/enrollments?user_id=self`,
          { headers: canvasHeaders }
        );

        if (enrollmentsResponse.ok) {
          const enrollments = await enrollmentsResponse.json();
          if (enrollments.length > 0) {
            gradesData[course.id] = {
              finalGrade: enrollments[0].grades?.final_grade || 'N/A',
              assignments: []
            };

            const assignmentsResponse = await fetch(
              `${CANVAS_BASE_URL}/courses/${course.id}/assignments`,
              { headers: canvasHeaders }
            );

            if (assignmentsResponse.ok) {
              const assignments = await assignmentsResponse.json();
              gradesData[course.id].assignments = assignments.map(a => ({
                id: a.id,
                name: a.name,
                dueAt: a.due_at
              }));
            }
          }
        }
      }
    }

    dataCache.all = {
      courseMap,
      gradesData,
      assignmentsData,
      courseIds: COURSE_IDS
    };
    cacheTimestamp = now;

    res.json({
      success: true,
      data: dataCache.all,
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

// Endpoint: obtener datos de un curso específico
app.get('/api/course/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!COURSE_IDS.includes(parseInt(courseId))) {
      return res.status(404).json({
        success: false,
        error: 'Course not in monitored list'
      });
    }

    const enrollmentsResponse = await fetch(
      `${CANVAS_BASE_URL}/courses/${courseId}/enrollments?user_id=self`,
      { headers: canvasHeaders }
    );

    if (!enrollmentsResponse.ok) {
      throw new Error('Failed to fetch enrollments');
    }

    const enrollments = await enrollmentsResponse.json();

    res.json({
      success: true,
      courseId,
      enrollments,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/dashboard',
      'GET /api/course/:courseId'
    ]
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[Canvas Proxy] Server listening on port ${PORT}`);
  console.log(`[Canvas Proxy] Dashboard available at https://canvas-proxy-production.up.railway.app/`);
  console.log(`[Canvas Proxy] Health check: https://canvas-proxy-production.up.railway.app/api/health`);
  console.log(`[Canvas Proxy] Monitoring ${COURSE_IDS.length} courses`);
  console.log(`[Canvas Proxy] Proxy running version 3.0.0 with embedded HTML dashboard`);
});

module.exports = app;
