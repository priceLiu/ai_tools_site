# 数据库脚本说明（外键与导入）

## `docs/fk.sql` 是做什么的？

`docs/fk.sql` 在**数据大批量导入完成之后**，把一批 **显式命名的外键** 再加回数据库。适用场景：

- 导入前为提速或避免顺序问题，**曾手动 `DROP CONSTRAINT` 掉部分外键**；
- 或从 dump/CSV 恢复时只在「无外键」状态下灌数，导入结束后再收紧约束。

**常规新库**：若已按 `scripts/apply-neon-migrations.sh` 跑完迁移，表结构里**多半已经带有等价的 `REFERENCES` / 约束**（名字可能与 `fk.sql` 不同）。此时**不要再跑** `fk.sql`，否则会报「约束已存在」。

---

## 与仓库迁移的关系

| 对象 | `fk.sql` 中的约束名 | 迁移 / 基准里的情况 |
|------|---------------------|----------------------|
| `tools.category_id` → `categories` | `fk_tools_category` | `20260101000000_baseline_core_schema.sql` 已在 `CREATE TABLE tools` 上定义 `category_id` 外键（`ON DELETE SET NULL`），一般**无需**再执行 `fk.sql` 里这一段。 |
| `favorites.tool_id` → `tools` | `fk_favorites_tool` | 基准里 `favorites.tool_id` 已有外键 + `ON DELETE CASCADE`。 |
| `favorites.user_id` → `profiles` | **脚本里注释为「不建」** | 本项目 Neon：**需要** `user_id` → `profiles`（基准里已建 `ON DELETE CASCADE`）。不要以 `fk.sql` 为准删掉用户对收藏的引用。 |
| `tools.user_id` → `profiles` | **脚本里写「不建」（历史 Supabase auth.users 备注）** | 当前应用：`tools.user_id` → `profiles`，且以 `ON DELETE SET NULL` 为准（见 `20260505010000_tools_user_id_set_null.sql`）。**不要**把用户外键永久省略。 |
| `tool_comments` / `tool_tags` / `navigation_menu_items` / `categories.parent_id` | 各 `fk_*` | 对应表在后续迁移里创建时，多数已带 `REFERENCES`；仅当你曾全部删掉这些约束时才需要执行 `fk.sql` 对应段。 |

结论：**`fk.sql` 是「补约束」的辅助脚本，不是一键建库的必备步骤；一键建库仍以 `supabase/migrations` 为准。** 更完整的流程见 `docs/neon-schema.md`、`deploy.md`。

---

## 使用步骤（仅在你明确曾去掉外键时）

1. **导入结束**且数据已按依赖关系合法（无孤儿 `tool_id`、`category_id` 等），或已用下面的 SQL 清理孤儿。
2. 在 Neon SQL Editor（或 `psql`）中**按文件从上到下**执行 `docs/fk.sql`。
3. 若某条 `ADD CONSTRAINT` 报错：
   - `already exists`：说明约束已在，可跳过该段。
   - `violates foreign key constraint`：仍有孤儿数据，先修正或置空后再加约束。

### 加约束前建议自检（示例`)

```sql
-- tools.category_id 指向不存在的分类
SELECT t.id, t.category_id
FROM public.tools t
WHERE t.category_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = t.category_id);

-- favorites.tool_id 孤儿
SELECT f.id, f.tool_id FROM public.favorites f
WHERE NOT EXISTS (SELECT 1 FROM public.tools t WHERE t.id = f.tool_id);

-- tool_comments / tool_tags 孤儿（表存在时）
SELECT id, tool_id FROM public.tool_comments tc
WHERE NOT EXISTS (SELECT 1 FROM public.tools t WHERE t.id = tc.tool_id);
```

---

## `fk.sql` 中各外键行为摘要

| 约束 | 行为 | 用途理解 |
|------|------|----------|
| `fk_tools_category` | `ON DELETE SET NULL` | 删分类时，工具上 `category_id` 置空，不删工具。 |
| `fk_favorites_tool` | `ON DELETE CASCADE` | 删工具时，收藏行一并删。 |
| `fk_tool_comments_tool` | `ON DELETE CASCADE` | 删工具时，评论一并删。 |
| `fk_tool_tags_tool` | `ON DELETE CASCADE` | 删工具时，能力标签关联一并删。 |
| `fk_tool_tags_tag` | `ON DELETE CASCADE` | 删标签时，关联行一并删。 |
| `fk_nav_parent` | `ON DELETE CASCADE` | 删父菜单项时子项一并删。 |
| `fk_category_parent` | `ON DELETE SET NULL` | 删父分类时，子分类 `parent_id` 置空。 |

`ON UPDATE NO ACTION`：业务里几乎不改主键 UUID，一般无感。

---

## 相关文档与脚本

- 一键迁移 / 新库：`scripts/apply-neon-migrations.sh`、`docs/neon-schema.md`
- 部署与环境变量：`deploy.md`
- 历史占位说明（勿当主建库脚本）：`docs/code_20260505.sql`
