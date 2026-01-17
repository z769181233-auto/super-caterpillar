# Full System Exception Audit Report
Generated: 2026年 1月17日 星期六 19时46分26秒 +07
------------------------------------
## Gate Failures
[1/3] Assert spawnWithTimeout kills on timeout (deterministic sleep)...

## Exception & Error Log Analysis
### API Errors
Binary file api_audit.log matches
### Worker Errors
[Bootstrap] ❌ DMMF Self-Check ERROR: Prisma DMMF not available or malformed
[CostLedger] ❌ Event failed: Failed to post cost event
[CostLedger] ❌ Event failed: Failed to post cost event
[CostLedger] ❌ Event failed: Failed to post cost event
[CostLedger] ❌ Event failed: Failed to post cost event
[CostLedger] ❌ Event failed: Failed to post cost event
[CostLedger] ❌ Event failed: Failed to post cost event
### Database Schema Anomalies
                                    Table "public.novel_scenes"
        Column        |              Type              | Collation | Nullable |       Default       
----------------------+--------------------------------+-----------+----------+---------------------
 id                   | text                           |           | not null | 
 chapter_id           | text                           |           | not null | 
 index                | integer                        |           | not null | 
 raw_text             | text                           |           |          | 
 enriched_text        | text                           |           |          | 
 visual_density_score | double precision               |           |          | 
 character_ids        | jsonb                          |           |          | 
 created_at           | timestamp(3) without time zone |           | not null | CURRENT_TIMESTAMP
 updated_at           | timestamp(3) without time zone |           | not null | 
 directing_notes      | text                           |           |          | 
 shot_type            | text                           |           |          | 'MEDIUM_SHOT'::text
 title                | text                           |           |          | 
 graph_state_snapshot | jsonb                          |           |          | 
 project_id           | text                           |           |          | 
 location_slug        | text                           |           |          | 
 time_of_day          | text                           |           |          | 
 environment_tags     | text[]                         |           |          | 
Indexes:
    "novel_scenes_pkey" PRIMARY KEY, btree (id)
    "idx_novel_scenes_env_tags_gin" gin (environment_tags)
    "idx_novel_scenes_location_slug" btree (location_slug)
    "novel_scenes_chapter_id_index_key" UNIQUE, btree (chapter_id, index)
Foreign-key constraints:
    "novel_scenes_chapter_id_fkey" FOREIGN KEY (chapter_id) REFERENCES novel_chapters(id) ON UPDATE CASCADE ON DELETE CASCADE

