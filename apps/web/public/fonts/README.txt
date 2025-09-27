Self-hosted font files used by the app. Current filenames wired in app/layout.tsx:

- noto-sans-sc-v39-chinese-simplified_latin-regular.woff2 (400)
- noto-sans-sc-v39-chinese-simplified_latin-700.woff2 (700)
- zcool-xiaowei-v15-chinese-simplified_latin-regular.woff2
- ma-shan-zheng-v14-latin-regular.woff2

Notes:
- Monospace Sarasa Gothic SC is NOT included yet as .woff2; we currently fall back to system monospace.
  If you provide a Sarasa Gothic SC .woff2 (or .woff/.otf), we can wire it via next/font/local.
- Fonts are referenced via relative paths from app/layout.tsx: ../public/fonts/*.woff2
