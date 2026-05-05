-- ==========================
-- 外键约束脚本（数据导入完成后再执行）
-- ==========================

-- tools → categories
ALTER TABLE ONLY public.tools
ADD CONSTRAINT fk_tools_category
FOREIGN KEY (category_id)
REFERENCES public.categories(id)
ON DELETE SET NULL
ON UPDATE NO ACTION;

-- tools → user (auth.users 迁移后无，故不建)

-- favorites → tools
ALTER TABLE ONLY public.favorites
ADD CONSTRAINT fk_favorites_tool
FOREIGN KEY (tool_id)
REFERENCES public.tools(id)
ON DELETE CASCADE
ON UPDATE NO ACTION;

-- favorites → user (不建)

-- tool_comments → tools
ALTER TABLE ONLY public.tool_comments
ADD CONSTRAINT fk_tool_comments_tool
FOREIGN KEY (tool_id)
REFERENCES public.tools(id)
ON DELETE CASCADE
ON UPDATE NO ACTION;

-- tool_tags → tools
ALTER TABLE ONLY public.tool_tags
ADD CONSTRAINT fk_tool_tags_tool
FOREIGN KEY (tool_id)
REFERENCES public.tools(id)
ON DELETE CASCADE
ON UPDATE NO ACTION;

-- tool_tags → tags
ALTER TABLE ONLY public.tool_tags
ADD CONSTRAINT fk_tool_tags_tag
FOREIGN KEY (tag_id)
REFERENCES public.tags(id)
ON DELETE CASCADE
ON UPDATE NO ACTION;

-- navigation_menu_items 自引用
ALTER TABLE ONLY public.navigation_menu_items
ADD CONSTRAINT fk_nav_parent
FOREIGN KEY (parent_id)
REFERENCES public.navigation_menu_items(id)
ON DELETE CASCADE
ON UPDATE NO ACTION;

-- categories 自引用
ALTER TABLE ONLY public.categories
ADD CONSTRAINT fk_category_parent
FOREIGN KEY (parent_id)
REFERENCES public.categories(id)
ON DELETE SET NULL
ON UPDATE NO ACTION;
