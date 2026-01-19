# V3 Contract Mapping SSOT (Single Source of Truth)

> **Purpose**: Establish an immutable mapping between the external "Bible V3" contract (strictly snake_case) and the internal V3.0 Database Schema (Camel/Snake mixed).
> **Rule**: API / Gate / Views MUST strictly use `Bible Field`. Internal Code uses `Internal Field`.

## 1. Novels (`v3_novels`)

Source Table: `novels`

| Bible Field (snake_case) | Internal Field (Schema) | DB Column (Raw) | Type      | Transformation | Note                                     |
| :----------------------- | :---------------------- | :-------------- | :-------- | :------------- | :--------------------------------------- |
| `id`                     | `id`                    | `id`            | UUID      | None           | PK                                       |
| `project_id`             | `projectId`             | `project_id`    | UUID      | None           | FK                                       |
| `title`                  | `title`                 | `title`         | Text      | None           |                                          |
| `author`                 | `author`                | `author`        | Text      | None           |                                          |
| `raw_file_url`           | `rawFileUrl`            | `raw_file_url`  | Text      | None           |                                          |
| `total_tokens`           | `totalTokens`           | `total_tokens`  | BigInt    | None           |                                          |
| `status`                 | `status`                | `status`        | Text      | None           | Enum: UPLOADING, PARSING, PARSED, FAILED |
| `created_at`             | `createdAt`             | `created_at`    | Timestamp | None           |                                          |
| `updated_at`             | `updatedAt`             | `updated_at`    | Timestamp | None           |                                          |

## 2. Novel Chapters (`v3_novel_chapters`)

Source Table: `novel_chapters`

| Bible Field (snake_case) | Internal Field (Schema) | DB Column (Raw)   | Type      | Transformation | Note                                                |
| :----------------------- | :---------------------- | :---------------- | :-------- | :------------- | :-------------------------------------------------- |
| `id`                     | `id`                    | `id`              | UUID      | None           | PK                                                  |
| `novel_id`               | `novelSourceId`         | `novel_source_id` | UUID      | **Renamed**    | Bible uses `novel_id`, Schema has `novel_source_id` |
| `volume_id`              | `volumeId`              | `volume_id`       | UUID      | None           |                                                     |
| `index`                  | `index`                 | `index`           | Int       | None           |                                                     |
| `title`                  | `title`                 | `title`           | Text      | None           |                                                     |
| `raw_content`            | `rawContent`            | `raw_content`     | Text      | None           |                                                     |
| `created_at`             | `createdAt`             | `created_at`      | Timestamp | None           |                                                     |

## 3. Scenes (`v3_scenes`)

Source Table: `scenes`

| Bible Field (snake_case) | Internal Field (Schema) | DB Column (Raw)        | Type      | Transformation | Note                                                           |
| :----------------------- | :---------------------- | :--------------------- | :-------- | :------------- | :------------------------------------------------------------- |
| `id`                     | `id`                    | `id`                   | UUID      | None           | PK                                                             |
| `chapter_id`             | `chapterId`             | `chapter_id`           | UUID      | None           |                                                                |
| `index`                  | `sceneIndex`            | `scene_index`          | Int       | **Renamed**    | Bible uses `index` (implied scene index), Schema `scene_index` |
| `title`                  | `title`                 | `title`                | Text      | None           |                                                                |
| `enriched_text`          | `enrichedText`          | `enriched_text`        | Text      | None           |                                                                |
| `visual_density`         | `visualDensityScore`    | `visual_density_score` | Float     | None           |                                                                |
| `status`                 | `status`                | `status`               | Text      | None           |                                                                |
| `created_at`             | `createdAt`             | `created_at`           | Timestamp | None           |                                                                |

## 4. Shots (`v3_shots`)

Source Table: `shots`

| Bible Field (snake_case) | Internal Field (Schema) | DB Column (Raw)    | Type | Transformation | Note                                                                                                                                                                                                               |
| :----------------------- | :---------------------- | :----------------- | :--- | :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | `id`                    | `id`               | UUID | None           | PK                                                                                                                                                                                                                 |
| `scene_id`               | `sceneId`               | `sceneId`          | UUID | None           | Note: Prisma raw column likely `sceneId` (no map) in some versions, but check `@@map`. Prisma raw: `sceneId` is unmapped? Checked Schema: `sceneId String`. No @map. So column is `"sceneId"`. View must quote it. |
| `index`                  | `index`                 | `index`            | Int  | None           |                                                                                                                                                                                                                    |
| `shot_type`              | `shotType`              | `shot_type`        | Text | None           |                                                                                                                                                                                                                    |
| `visual_prompt`          | `visualPrompt`          | `visual_prompt`    | Text | None           |                                                                                                                                                                                                                    |
| `camera_movement`        | `cameraMovement`        | `camera_movement`  | Text | None           |                                                                                                                                                                                                                    |
| `duration_sec`           | `durationSeconds`       | `durationSeconds`  | Int  | None           | Check schema: `durationSeconds Int?` but also `durationSec Decimal? @map("duration_sec")`. Using **V3 Field `duration_sec`** mapping to `durationSec` column.                                                      |
| `render_status`          | `renderStatus`          | `render_status`    | Text | None           |                                                                                                                                                                                                                    |
| `result_image_url`       | `resultImageUrl`        | `result_image_url` | Text | None           |                                                                                                                                                                                                                    |

> **Critical Note on Views**:
> Views must alias columns to `Bible Field`.
> Example: `SELECT "sceneIndex" AS "index" FROM scenes` (if raw is camel) OR `SELECT scene_index AS index` (if raw is snake).
> Based on Reality Check, `scenes` table has `scene_index`.
