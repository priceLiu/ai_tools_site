-- 支持二级分类：子分类指向父分类，工具归入「叶子分类」为宜

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON public.categories (parent_id);
