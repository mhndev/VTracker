# Theme

## Compact token summary

- Fonts: `DM Sans` 400–700 for body/UI; `Manrope` 600–800 for headings and large numbers.
- Base: background `#f6f7fb`, surfaces `#ffffff`, ink `#1d2033`, body `#202338`, muted `#7c8298`, line `#e9eaf1`.
- Brand: violet `#6558f5`, dark violet `#4e43d7`; logo gradient `#7165ff → #5547dc`.
- Status: green `#1a9b70` / `#20ac79`, amber `#d88716`, red `#d84f5e`.
- Supporting fills: violet `#eeecff`, mint `#e4f7f0`, peach `#fff0e2`, sky `#e5f3fd`.
- Shape: 8–13px controls, 16px cards, pill badges at 999px.
- Shadows: very soft violet-black shadows, typically `0 8px 30px #25233c08`; primary button `0 9px 21px #6558f531`.
- Layout: 244px sidebar, 79px sticky header, centered content up to 1460px, 19px major grid gaps.
- Breakpoints: 1080px collapses multi-column grids; 760px produces mobile nav/admin rail; 430px stacks metrics.
- Icons: Lucide React, 15–21px, rounded 1.5–2px stroke appearance.
- Motion: 200ms navigation drawer; 1s linear refresh spinner. Keep motion restrained and functional.

## Raw design tokens

Source: `src/packages/ui/src/styles.css`

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
:root { font-family: 'DM Sans', sans-serif; color: #202338; background: #f6f7fb; font-synthesis: none; --ink:#1d2033; --muted:#7c8298; --line:#e9eaf1; --purple:#6558f5; --purple-dark:#4e43d7; --green:#1a9b70; --amber:#d88716; --red:#d84f5e; }
* { box-sizing: border-box; }
body { margin:0; min-width:320px; min-height:100vh; background:#f6f7fb; }
button,input,select,textarea{font:inherit}
h1,h2,h3{font-family:'Manrope',sans-serif;letter-spacing:-.035em}
.primary{background:var(--purple);color:#fff;box-shadow:0 9px 21px #6558f531}
.surface{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 8px 30px #25233c08;overflow:hidden}
.pill.green{color:#17835f;background:#e5f7f0}.pill.amber{color:#ad6e18;background:#fff0dd}.pill.red{color:#b63c49;background:#ffe7ea}.pill.gray{color:#73788b;background:#eff0f4}
```

There is no Tailwind configuration or theme provider. Full responsive component CSS remains in `src/packages/ui/src/styles.css`; admin-specific table and control-center CSS is in `src/apps/admin/src/styles.css`.
