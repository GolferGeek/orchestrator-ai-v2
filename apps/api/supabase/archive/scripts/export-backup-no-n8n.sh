#!/bin/bash
# Export COMPLETE database backup excluding n8n schema
# This creates a full backup that can be used for disaster recovery
# Excludes n8n schema to avoid licensing issues

set -e  # Exit on error

# Configuration
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
BACKUP_DIR="apps/api/supabase/backups"
DB_CONTAINER="supabase_db_api-dev"
DB_USER="postgres"
DB_NAME="postgres"

# Create directories
mkdir -p "$BACKUP_DIR"

echo "🔒 Creating FULL database backup (excluding n8n schema): $TIMESTAMP"
echo "   This includes ALL schemas and ALL data EXCEPT n8n"
echo ""

# Create full backup excluding n8n schema
echo "📦 Exporting database (excluding n8n schema)..."
BACKUP_FILE="$BACKUP_DIR/full-backup-no-n8n-$TIMESTAMP.sql"
docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --exclude-schema=n8n \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  > "$BACKUP_FILE"

# Compress backup
echo "🗜️  Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"
echo "   ✅ Backup compressed: $BACKUP_FILE_GZ"
echo ""

# Create metadata file
echo "📋 Creating metadata..."
METADATA_FILE="${BACKUP_FILE%.sql}.metadata.json"
cat > "$METADATA_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "created_at": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")",
  "type": "full-backup-no-n8n",
  "description": "Complete database backup excluding n8n schema for intern setup",
  "schemas_included": ["public", "auth", "storage", "company", "observability", "rag", "marketing"],
  "schemas_excluded": ["n8n"],
  "includes": {
    "schema": true,
    "all_data": true,
    "auth_users": true,
    "rbac": true,
    "agents": true,
    "llm_config": true,
    "marketing": true,
    "rag_schema": true
  },
  "db_container": "$DB_CONTAINER",
  "backup_file": "$(basename $BACKUP_FILE_GZ)",
  "restore_command": "gunzip -c $BACKUP_DIR/$(basename $BACKUP_FILE_GZ) | docker exec -i -e PGPASSWORD=postgres $DB_CONTAINER psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME"
}
EOF

echo "   ✅ Metadata created: $METADATA_FILE"
echo ""

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ FULL BACKUP CREATED SUCCESSFULLY!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📂 Backup location: $BACKUP_FILE_GZ"
echo "📊 Backup size:     $BACKUP_SIZE"
echo ""
echo "📋 Included Schemas:"
echo "   ✅ public"
echo "   ✅ auth"
echo "   ✅ storage"
echo "   ✅ company"
echo "   ✅ observability"
echo "   ✅ rag"
echo "   ✅ marketing"
echo ""
echo "🚫 Excluded Schemas:"
echo "   ❌ n8n (excluded to avoid licensing issues)"
echo ""
echo "🔄 To restore this backup:"
echo "   gunzip -c $BACKUP_DIR/$(basename $BACKUP_FILE_GZ) | docker exec -i -e PGPASSWORD=postgres $DB_CONTAINER psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME"
echo ""
echo "📤 To share with team:"
echo "   cp $BACKUP_FILE_GZ ~/Downloads/backup-no-n8n-$TIMESTAMP.sql.gz"
echo ""

