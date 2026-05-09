# 前台主色与主按钮（统一用色）

站点 **主品牌紫 / 主按钮填充色** 以 CSS 变量为准，与「AI 工具提交」等默认实心按钮一致。**勿**在业务组件里写死的 `#6366f1` 等 Hex 替代 `--primary`，以免明暗主题分叉。

## 浅色主题（默认）

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--primary` | `oklch(0.55 0.25 280)` | 主按钮背景、强调悬浮条、徽标主色等 |
| `--primary-foreground` | `oklch(1 0 0)` | 主色上的文字 / 图标（通常为白） |

源码位置：[`app/globals.css`](../app/globals.css) `:root`。

## 在组件中使用

- Tailwind：**`bg-primary text-primary-foreground`**（与 [`components/ui/button.tsx`](../components/ui/button.tsx) 的 `variant="default"` 一致）。
- 图标在主色块上：使用 **`text-primary-foreground`**，勿再用 `text-primary`（对比度不足）。

深色主题的 `--primary` 语义不同（见同文件 `.dark`），组件仍只绑定语义类即可。

## 已对齐的示例

- **`ExcellentSolutionsFab`**：右侧纵向「AI方案集」入口，使用 `bg-primary text-primary-foreground`。
