#!/usr/bin/env python3
"""
Execute Supabase migrations
Usage: python scripts/run_migrations.py
"""

import os
import glob
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2 import sql
except ImportError:
    print("❌ psycopg2 not installed")
    print("   Install with: pip install psycopg2-binary")
    sys.exit(1)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    print("❌ Missing environment variables")
    sys.exit(1)

# Parse Supabase URL
url_parts = SUPABASE_URL.replace("https://", "").split(".supabase.co")
project_id = url_parts[0]
db_url = f"postgresql://postgres:{SERVICE_KEY}@{project_id}.supabase.co:5432/postgres"

print(f"🔗 Connecting to Supabase: {project_id}")

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    print("✅ Connected\n")

    # Find migrations
    migrations_dir = Path(__file__).parent.parent / "supabase" / "migrations"
    migration_files = sorted(glob.glob(str(migrations_dir / "076_*.sql")))
    migration_files.extend(sorted(glob.glob(str(migrations_dir / "077_*.sql"))))
    migration_files.extend(sorted(glob.glob(str(migrations_dir / "078_*.sql"))))
    migration_files.extend(sorted(glob.glob(str(migrations_dir / "079_*.sql"))))
    migration_files.extend(sorted(glob.glob(str(migrations_dir / "080_*.sql"))))
    migration_files.extend(sorted(glob.glob(str(migrations_dir / "081_*.sql"))))

    completed = 0
    failed = 0

    for migration_file in migration_files:
        try:
            filename = Path(migration_file).name
            print(f"📝 Running: {filename}")

            with open(migration_file, "r") as f:
                sql_content = f.read()

            # Execute each statement
            statements = [s.strip() for s in sql_content.split(";") if s.strip()]
            for stmt in statements:
                cur.execute(stmt)

            print(f"✅ {filename}\n")
            completed += 1

        except Exception as e:
            print(f"❌ {filename}")
            print(f"   Error: {str(e)}\n")
            failed += 1

    print("=" * 50)
    print(f"📊 Results: {completed} completed, {failed} failed")

    if failed > 0:
        sys.exit(1)

    print("✨ All migrations completed!")

except Exception as e:
    print(f"❌ Connection error: {str(e)}")
    sys.exit(1)

finally:
    try:
        cur.close()
        conn.close()
    except:
        pass
