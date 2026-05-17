const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

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

// Dashboard HTML embebido
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
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 14px;
        }

        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        button:active {
            transform: translateY(0);
        }

        .status {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            padding: 8px 12px;
            background: #f0f0f0;
            border-radius: 6px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #4ade80;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
            margin-bottom: 24px;
        }

        .metric-card {
            background: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            border-left: 4px solid #667eea;
        }

        .metric-label {
            font-size: 11px;
            color: #999;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .metric-value {
            font-size: 28px;
            font-weight: bold;
            color: #667eea;
        }

        .user-info {
            background: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            margin-bottom: 24px;
            border-top: 3px solid #764ba2;
        }

        .user-info h3 {
            color: #764ba2;
            margin-bottom: 12px;
            font-size: 14px;
        }

        .user-detail {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            font-size: 12px;
        }

        .user-detail-item label {
            display: block;
            color: #999;
            margin-bottom: 4px;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .user-detail-item span {
            color: #333;
            font-weight: 500;
        }

        .section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
            color: white;
        }

        .courses-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
        }

        .course-card {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            transition: all 0.3s;
            border-top: 3px solid #667eea;
        }

        .course-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.12);
        }

        .course-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 14px;
        }

        .course-id {
            font-size: 11px;
            opacity: 0.8;
            margin-bottom: 4px;
        }

        .course-name {
            font-size: 15px;
            font-weight: 600;
            line-height: 1.3;
        }

        .course-body {
            padding: 14px;
        }

        .course-stat {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 12px;
            border-bottom: 1px solid #f0f0f0;
            padding-bottom: 8px;
        }

        .course-stat:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }

        .course-stat-label {
            color: #999;
        }

        .course-stat-value {
            font-weight: 600;
            color: #667eea;
        }

        .grade {
            font-size: 16px;
            font-weight: bold;
            color: #764ba2;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: white;
        }

        .error {
            background: #fee;
            color: #c33;
            padding: 16px;
            border-radius: 8px;
            border-left: 4px solid #c33;
            margin-bottom: 20px;
        }

        .timestamp {
            font-size: 12px;
            color: rgba(255,255,255,0.8);
            margin-top: 20px;
            text-align: right;
        }

        @media (max-width: 768px) {
            .header {
                padding: 16px;
            }

            .header h1 {
                font-size: 22px;
            }

            .metrics {
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
            }

            .metric-card {
                padding: 12px;
            }

            .metric-value {
                font-size: 24px;
            }

            .courses-grid {
                grid-template-columns: 1fr;
            }

            .controls {
                flex-direction: column;
                align-items: stretch;
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
            <h1>📊 Canvas Dashboard</h1>
            <p>Sistema de monitoreo de cursos en tiempo real</p>
            <div class="controls">
                <button id="refreshBtn" onclick="loadData()">🔄 Actualizar</button>
                <div class="status">
                    <div class="status-dot"></div>
                    <span id="statusText">Cargando...</span>
                </div>
            </div>
        </div>

        <div id="errorContainer"></div>

        <div class="user-info" id="userInfo" style="display:none;">
            <h3>👤 Información de Usuario</h3>
            <div class="user-detail">
                <div class="user-detail-item">
                    <label>Nombre</label>
                    <span id="userName">-</span>
                </div>
                <div class="user-detail-item">
                    <label>ID</label>
                    <span id="userId">-</span>
                </div>
            </div>
        </div>

        <div class="metrics" id="metricsContainer">
            <div class="metric-card">
                <div class="metric-label">Cursos Activos</div>
                <div class="metric-value" id="totalCourses">-</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Promedio</div>
                <div class="metric-value" id="avgGrade">-</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Tareas Pendientes</div>
                <div class="metric-value" id="pendingTasks">-</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Estado</div>
                <div class="metric-value" id="status" style="font-size: 14px;">-</div>
            </div>
        </div>

        <div>
            <h2 class="section-title">📚 Cursos Monitoreados</h2>
            <div id="coursesContainer" class="courses-grid">
                <div class="loading">Cargando información de cursos...</div>
            </div>
        </div>

        <div class="timestamp">
            <span id="lastUpdate">Última actualización: -</span>
        </div>
    </div>

    <script>
        const API_URL = '/api';

        async function loadData() {
            const statusText = document.getElementById('statusText');
            const errorContainer = document.getElementById('errorContainer');

            try {
                statusText.textContent = 'Conectando...';
                errorContainer.innerHTML = '';

                const response = await fetch(\`\${API_URL}/dashboard\`);
                if (!response.ok) throw new Error(\`HTTP \${response.status}\`);

                const data = await response.json();
                renderDashboard(data);

                statusText.textContent = '✓ Conectado';
                document.getElementById('lastUpdate').textContent =
                    \`Última actualización: \${new Date().toLocaleString('es-ES')}\`;

            } catch (error) {
                statusText.textContent = '✗ Error';
                errorContainer.innerHTML = \`
                    <div class="error">
                        <strong>Error al conectar:</strong> \${error.message}
                    </div>
                \`;
                console.error('Error:', error);
            }
        }

        function renderDashboard(data) {
            const courseMap = data.data?.courseMap || {};
            const gradesData = data.data?.gradesData || {};
            const assignmentsData = data.data?.assignmentsData || {};

            // User Info
            document.getElementById('userInfo').style.display = 'block';
            document.getElementById('userName').textContent = 'NICOLAS MARTIN GAMONAL ZOREC';
            document.getElementById('userId').textContent = '129355';

            // Metrics
            const courseIds = Object.keys(courseMap);
            const grades = Object.values(gradesData)
                .map(g => g.final_score || 0)
                .filter(g => g > 0);
            const avgGrade = grades.length > 0
                ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1)
                : 0;

            const pendingAssignments = Object.values(assignmentsData)
                .reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

            document.getElementById('totalCourses').textContent = courseIds.length;
            document.getElementById('avgGrade').textContent = avgGrade;
            document.getElementById('pendingTasks').textContent = pendingAssignments;
            document.getElementById('status').textContent = 'Activo';

            // Courses Grid
            const coursesContainer = document.getElementById('coursesContainer');
            if (courseIds.length === 0) {
                coursesContainer.innerHTML = '<div class="loading">No hay cursos disponibles</div>';
                return;
            }

            coursesContainer.innerHTML = courseIds.map(courseId => {
                const courseName = courseMap[courseId] || 'Sin nombre';
                const gradeInfo = gradesData[courseId] || {};
                const assignments = assignmentsData[courseId] || [];
                const finalScore = (gradeInfo.final_score || 0).toFixed(1);

                return \`
                    <div class="course-card">
                        <div class="course-header">
                            <div class="course-id">ID: \${courseId}</div>
                            <div class="course-name">\${courseName}</div>
                        </div>
                        <div class="course-body">
                            <div class="course-stat">
                                <span class="course-stat-label">Calificación Final</span>
                                <span class="course-stat-value grade">\${finalScore}</span>
                            </div>
                            <div class="course-stat">
                                <span class="course-stat-label">Tareas Próximas</span>
                                <span class="course-stat-value">\${assignments.length}</span>
                            </div>
                            \${assignments.length > 0 ? \`
                                <div class="course-stat">
                                    <span class="course-stat-label">Próxima Tarea</span>
                                    <span class="course-stat-value" style="font-size: 11px;">
                                        \${new Date(assignments[0].due_at).toLocaleDateString('es-ES')}
                                    </span>
                                </div>
                            \` : ''}
                        </div>
                    </div>
                \`;
            }).join('');
        }

        // Load data on page load
        loadData();
    </script>
</body>
</html>`;

// Endpoint: servir dashboard desde la raíz
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(dashboardHTML);
});

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
  console.log(`[Canvas Proxy] Dashboard available at https://canvas-proxy-production.up.railway.app/`);
});

module.exports = app;
// Force redeploy Sun May 17 17:20:28 UTC 2026
