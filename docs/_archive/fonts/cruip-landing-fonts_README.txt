[ARCHIVED] Self-hosted font files used by the landing app. Filenames wired in app/layout.tsx:

- noto-sans-sc-v39-chinese-simplified_latin-regular.woff2 (400)
- noto-sans-sc-v39-chinese-simplified_latin-700.woff2 (700)
- zcool-xiaowei-v15-chinese-simplified_latin-regular.woff2
- ma-shan-zheng-v14-latin-regular.woff2

Notes:
- Sarasa Gothic SC .woff2 is not present; using system monospace fallback for now.
  Provide a Sarasa Gothic SC .woff2/.woff/.otf to self-host via next/font/local.
- Fonts are referenced via relative paths from app/layout.tsx: ../public/fonts/*.woff2
