# Desplegar QA Center v2 en Render

## Estado Actual
- ✅ Fase 1: Migraciones SQL creadas (6 archivos)
- ✅ Tipos TypeScript actualizados
- ✅ Helpers (journey, scoring) implementados
- ⏳ Migraciones aún no ejecutadas en Supabase
- ⏳ UI: Por crear (Fase 2)

## Pasos para Deploy

### 1. Ejecutar Migraciones en Supabase (PRIMERO)

#### Opción A: Dashboard Supabase (Recomendado)
1. Ve a https://supabase.com/dashboard
2. Selecciona proyecto `blyzfuwwxwpuihrjdpuh`
3. SQL Editor → New Query
4. Copia cada archivo SQL en orden (076 → 081)
5. Ejecuta cada uno

**Archivos en orden:**
- `supabase/migrations/076_qa_customer_journeys.sql`
- `supabase/migrations/077_qa_departments.sql`
- `supabase/migrations/078_qa_forbidden_rules.sql`
- `supabase/migrations/079_qa_alerts.sql`
- `supabase/migrations/080_qa_transcript_segments.sql`
- `supabase/migrations/081_qa_roles_and_permissions.sql`

#### Opción B: Localmente (Requiere psql/Python)
```bash
# Python
python scripts/run_migrations.py

# Node.js
node scripts/migrate.js
```

### 2. Configurar Render

1. Ve a https://dashboard.render.com
2. Selecciona servicio `voiceos-app`
3. Settings → Environment
4. Agregar/Actualizar variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://blyzfuwwxwpuihrjdpuh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseXpmdXd3eHdwdWlocmpkcHVoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTU3NjcxNSwiZXhwIjoyMDk1MTUyNzE1fQ.AinY8jN96iaT2F0aPXXyeYaV-Fpp3ZUhrZzEA95i-PQ
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseXpmdXd3eHdwdWlocmpkcHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NzY3MTUsImV4cCI6MjA5NTE1MjcxNX0.1DrrZqqie8Oqvm6Jtb2TiWbmVFD6Fsy8v3EG4ah7rTA
```

### 3. Hacer Push a GitHub

```bash
# Los cambios ya están en rama voiceos-saas-build
git push origin voiceos-saas-build
```

Render tiene auto-deploy configurado, así que:
- → Render detectará el push
- → Ejecutará build (npm run build)
- → Desplegará automáticamente
- → Accesible en https://voiceos-app.onrender.com/qa-center

### 4. Verificar Deploy

1. Espera ~3-5 minutos por el build
2. Ve a https://voiceos-app.onrender.com/qa-center
3. Comprueba que:
   - ✅ La página carga sin errores
   - ✅ No hay TypeScript errors
   - ✅ Puedes acceder a la URL

4. En Render Dashboard:
   - Logs → Busca "Build finished"
   - Debe decir "Build succeeded"

## Checklist Pre-Deploy

- [ ] Migraciones ejecutadas en Supabase (verifica en SQL Editor)
- [ ] Tablas creadas: `SELECT COUNT(*) FROM qa_customer_journeys;`
- [ ] Roles creados: `SELECT COUNT(*) FROM qa_roles WHERE is_system = true;` (debe ser 5)
- [ ] Código pusheado a GitHub (rama voiceos-saas-build)
- [ ] Variables de entorno en Render

## URLs de Verificación

Después del deploy, estas URLs estarán disponibles:

- **QA Center Dashboard:** https://voiceos-app.onrender.com/qa-center
- **API Health:** https://voiceos-app.onrender.com/api/health
- **Render Logs:** https://dashboard.render.com/services/voiceos-app

## Rollback Si Falla

Si el deploy falla:

1. **Build error:**
   - Revisa logs en Render dashboard
   - Busca línea de error (ej: "Type 'QADepartment' not found")
   - Edita archivo correspondiente
   - Haz nuevo push

2. **Database error:**
   - Verifica que migraciones se ejecutaron
   - Revisa Supabase Activity log
   - Re-ejecuta migración que falló
   - Redeploy en Render

3. **Runtime error:**
   - Revisa Render logs
   - Busca "Error" o "Exception"
   - Típicamente tipo mismatch o función no encontrada
   - Edita código, pusea, redeploy

## Próximas Fases

Una vez Fase 1 esté live:

### Fase 2: UI Reconstrucción
- Dashboard layout (3 columnas)
- Call list con filtros
- Audio player + transcript
- Score card
- Journey context

### Fase 3: Análisis
- Scoring con prompts por departamento
- Detección de reglas prohibidas
- Generación de alertas
- Telegram notifications

### Fase 4: Configuración
- Panel de departamentos
- Panel de reglas
- Panel de roles
- Centro de alertas

## Support

Si tienes preguntas o problemas:

1. Revisa `docs/QA_CENTER_V2_PHASE1.md`
2. Revisa `docs/EXECUTE_MIGRATIONS.md`
3. Chequea Render logs
4. Chequea Supabase Activity
5. Revisa commit messages para contexto

---

**Branch:** voiceos-saas-build  
**Commits:** 7827c74, 5c3496c, 276cf5d, b6aaa2d  
**Status:** Ready for Phase 1 deployment  
