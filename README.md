# showcase

Repository untuk menampilkan tugas-tugas peserta PKL Cibinong 2026 dalam satu halaman **2 kolom grid peserta**, tema **Dark Brutalism (palet Cursor Dark)**, dan tipografi **JetBrains Mono**.

## Fitur Utama

- **Tanpa `fetch()` / Bisa Dibuka Langsung**: Data dibaca dari [`data/showcase.js`](./data/showcase.js) via `<script>`, sehingga `index.html` bisa dibuka langsung melalui `file://` (double-click) maupun di-host di GitHub Pages tanpa error CORS.
- **Dark / Light Theme Switcher**: Header ringkas di bagian atas untuk beralih antara tema **Cursor Dark** dan **Light Brutalism** (tersimpan di `localStorage`).
- **2-Column Participant Grid**: Langsung menampilkan grid peserta PKL berdampingan (`Muhammad Hubbi El Fairuz / @Hubbi502` dan `Yuan Latisa / @yuan-latisa`) dengan navigasi breadcrumb & folder kategori ala GitHub (default di root tanpa folder aktif; klik folder untuk membuka dan menampilkannya aktif di atas beserta navigasi `← ..`, breadcrumb, dan `◀`/`▶`).
- **Hover Live Preview Popover**: Arahkan kursor (hover) ke baris tugas untuk melihat preview halaman secara live (`<iframe>` skala desktop `1280×800`, atau `thumbnail` opsional) lengkap dengan tombol **VIEW FULL PAGE ↗**.

---

## Cara Mengubah Data di `data/showcase.js`

Edit [`data/showcase.js`](./data/showcase.js):

```js
window.SHOWCASE_DATA = {
  "repository": {
    "owner": "PKL-CIBINONG-2026",
    "name": "showcase"
  },
  "categories": {
    "html-css": { "label": "HTML & CSS", "color": "#83D6C5" },
    "javascript": { "label": "JavaScript", "color": "#EBCB8B" }
  },
  "students": [
    {
      "id": "nama-peserta",
      "name": "Nama Peserta",
      "github": "username-github",
      "profileUrl": "https://github.com/orgs/PKL-CIBINONG-2026/people/username-github",
      "role": "PKL-CIBINONG-2026",
      "batch": "Peserta PKL",
      "avatar": "",
      "tasks": [
        {
          "title": "01-nama-tugas",
          "description": "Deskripsi singkat tugas.",
          "category": "html-css",
          "pagesUrl": "https://pkl-cibinong-2026.github.io/01-nama-tugas/",
          "repoUrl": "https://github.com/PKL-CIBINONG-2026/01-nama-tugas",
          "thumbnail": "",
          "updatedAt": "2026-11-16"
        }
      ]
    }
  ]
};
```

## Menjalankan & Deploy

- **Lokal**: Langsung buka `index.html` di browser (`file://`), atau jalankan `python -m http.server 8080`.
- **GitHub Pages**: Push ke branch `main`, lalu aktifkan **Settings → Pages → Deploy from a branch (`main` / `(root)`)**.
