# Ejecutar Migraciones QA Center v2

## Opción 1: Desde Supabase Dashboard (Más Simple)

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto `blyzfuwwxwpuihrjdpuh`
3. Ve a **SQL Editor**
4. Haz clic en **New Query**
5. Copia y pega cada migración en orden:

### Migración 076: Customer Journeys
```sql
-- Archivo: supabase/migrations/076_qa_customer_journeys.sql
[COPIAR CONTENIDO DEL ARCHIVO]
```

### Migración 077: Departments
```sql
-- Archivo: supabase/migrations/077_qa_departments.sql
[COPIAR CONTENIDO DEL ARCHIVO]
```

### Migración 078: Forbidden Rules
```sql
-- Archivo: supabase/migrations/078_qa_forbidden_rules.sql
[COPIAR CONTENIDO DEL ARCHIVO]
```

### Migración 079: Alerts
```sql
-- Archivo: supabase/migrations/079_qa_alerts.sql
[COPIAR CONTENIDO DEL ARCHIVO]
```

### Migración 080: Transcript Segments
```sql
-- Archivo: supabase/migrations/080_qa_transcript_segments.sql
[COPIAR CONTENIDO DEL ARCHIVO]
```

### Migración 081: Roles
```sql
-- Archivo: supabase/migrations/081_qa_roles_and_permissions.sql
[COPIAR CONTENIDO DEL ARCHIVO]
```

Ejecuta cada una por separado presionando **Ctrl+Enter** o el botón **Run**.

---

## Opción 2: Desde CLI (Para Automation)

```bash
# Instalar Supabase CLI
npm install -D supabase

# Enlazar proyecto
npx supabase link --project-ref blyzfuwwxwpuihrjdpuh

# Ejecutar todas las migraciones pendientes
npx supabase migration list
npx supabase db push
```

---

## Opción 3: Script Node (En Desarrollo)

```bash
# Instalar dependencias
npm install pg

# Ejecutar migraciones
node scripts/migrate-node.js
```

---

## Verificación

Después de ejecutar las migraciones, verifica que las tablas fueron creadas:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'qa_%'
ORDER BY table_name;
```

Debería mostrar:
- `qa_alerts`
- `qa_alerts_audit`
- `qa_alerts_telegram_queue`
- `qa_call_transcript_summary`
- `qa_customer_journeys`
- `qa_department_audit`
- `qa_departments`
- `qa_forbidden_rules`
- `qa_forbidden_rules_versions`
- `qa_journey_calls`
- `qa_roles`
- `qa_transcript_segments`
- `qa_user_roles`

---

## Verificar Roles Creados

```sql
SELECT * FROM qa_roles WHERE is_system = true ORDER BY name;
```

Debería mostrar 5 roles:
1. Owner/Admin
2. QA Manager
3. Supervisor
4. Agent
5. Viewer

---

## Troubleshooting

### Error: "FATAL: remaining connection slots are reserved"
→ Espera 2-3 minutos y reintentar

### Error: "relation already exists"
→ La tabla ya fue creada. Puedes ignorarlo.

### Error: "type already exists"
→ El enum ya fue creado. Puedes ignorarlo.

### Error: "function already exists"
→ La función ya fue creada. Puedes ignorarlo.

---

## Next Steps

Una vez las migraciones estén aplicadas:

1. Actualiza `.env.local` con Supabase credentials
2. Ejecuta `npm run build` para verificar tipos TypeScript
3. Ejecuta `npm run dev` para ver cambios locales
4. Haz push a Render
5. Verifica en `https://voiceos-app.onrender.com/qa-center`
