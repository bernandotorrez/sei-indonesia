# Cara Menjalankan Aplikasi

Halo! Ini panduan cara menjalankan aplikasi Stock Opname ini di komputermu. Kalau mau tahu
fitur-fiturnya apa aja, buka [README.md](README.md) — di sini fokusnya cuma "gimana caranya
nyalain aplikasi ini".

Ada dua cara buat jalanin aplikasi ini. Pilih salah satu aja ya, jangan dua-duanya bareng
karena bakal rebutan port yang sama (3000, 4000, 5432).

- **Cara pertama (pakai Docker)** — paling gampang, tinggal satu perintah, cocok kalau cuma
  mau lihat/coba aplikasinya jalan.
- **Cara kedua (manual, pakai npm)** — sedikit lebih ribet tapi lebih enak kalau kamu mau
  ngoprek/edit kodenya, karena hot-reload-nya lebih responsif.

---

## Cara 1: Semuanya lewat Docker

Ini cara paling santai. Kamu cuma perlu Docker terinstall, tidak perlu install Node.js sama
sekali.

Pertama, copy file environment-nya dulu:

```bash
cp .env.example .env
```

Kalau mau, buka file `.env` yang baru dibuat itu, dan isi `JWT_SECRET` dengan string acak
(bebas, asal panjang). Kalau kamu sudah punya key reCAPTCHA, isi juga di sini — tapi kalau
belum ada, dikosongkan saja tidak masalah, aplikasinya tetap jalan normal.

Setelah itu, tinggal jalankan:

```bash
docker compose up --build
```

Terus tunggu aja. Di belakang layar, ini bakal otomatis: nyalain database, nunggu database-nya
siap, bikin tabel-tabel & data contoh (user demo, produk demo), lalu nyalain API, worker, dan
aplikasi frontend-nya. Kamu bakal lihat banyak log lewat di terminal — itu normal, tunggu sampai
muncul baris kira-kira begini:

```
frontend-1  | Listening on http://[::]:3000
backend-1   | Stock Opname API listening on port 4000
```

Kalau sudah muncul itu, buka browser ke **http://localhost:3000** — selesai, tinggal login.

Buat matiin semuanya, tekan `Ctrl+C` lalu jalankan:

```bash
docker compose down
```

Data yang sudah kamu buat tidak akan hilang walau sudah dimatikan — akan tetap ada kalau
dinyalain lagi nanti. Kalau kamu justru mau mulai dari nol lagi (hapus semua data), baru pakai
`docker compose down -v`.

Beberapa perintah yang mungkin berguna sambil jalan:

```bash
docker compose logs -f backend      # mau lihat log backend aja
docker compose ps                   # cek semua service statusnya gimana
docker compose up --build           # abis ubah kode, jalanin ini lagi biar ke-build ulang
```

---

## Cara 2: Manual, jalanin satu-satu pakai npm

Cara ini butuh 3 tab terminal yang dibiarkan terbuka sekalian jalan.

**Terminal pertama, buat backend-nya:**

```bash
cd stock-opname-be
cp .env.example .env
npm install
docker compose up -d
npm run migrate
npm run seed
npm run dev
```

Baris-baris `cp`, `npm install`, `npm run migrate`, dan `npm run seed` itu cukup dijalankan
sekali aja di awal. Kalau besok-besok mau jalanin lagi, tinggal `docker compose up -d` terus
`npm run dev`.

**Terminal kedua, buat worker-nya (proses yang mengurus reconciliation di belakang layar):**

```bash
cd stock-opname-be
npm run worker:dev
```

Ini sebenarnya bisa dilewat kalau cuma mau coba-coba sebentar, karena API-nya juga otomatis
"nyolek" worker setiap ada approval. Tapi kalau mau demo yang meyakinkan bahwa prosesnya
beneran async (jalan di belakang layar, bukan cuma kebetulan cepat), nyalakan juga worker ini.

**Terminal ketiga, buat frontend-nya:**

```bash
cd stock-opname-fe
cp .env.example .env
npm install
npm run dev
```

Buka **http://localhost:3000**, selesai.

Buat matiin semuanya: tekan `Ctrl+C` di ketiga terminal, terus `docker compose down` di folder
`stock-opname-be` untuk matiin database-nya.

---

## Akun buat login

Semua akun ini sudah otomatis dibuatkan waktu proses seed jalan tadi. Password-nya sama semua.

| Role | Email | Password |
|---|---|---|
| Admin | admin@stockopname.test | password123 |
| Manager | manager@stockopname.test | password123 |
| Staff | staff1@stockopname.test | password123 |
| Staff | staff2@stockopname.test | password123 |

Coba login gantian pakai akun-akun ini — tampilan dan menunya beda-beda sesuai role-nya.

## Kalau mau coba alur lengkapnya

1. Login sebagai **manager**, buka menu Sessions, klik New Session, pilih staff dan produk yang
   mau dihitung, lalu Initiate.
2. Logout, login sebagai **staff** yang tadi ditugaskan. Buka sesinya, isi jumlah hasil hitung
   fisik (boleh kamu bikin beda dari angka "Expected" biar kelihatan ada selisihnya), lalu
   Submit Counts.
3. Logout, login lagi sebagai **manager**. Buka sesi tadi, lihat kolom selisihnya, lalu klik
   Approve (atau Reject kalau mau coba jalur penolakan).
4. Kalau di-approve, statusnya bakal berubah jadi "Approving..." sebentar, terus otomatis jadi
   "Approved" dalam sekitar 1-2 detik tanpa perlu refresh manual. Cek menu Products, stoknya
   sudah ikut berubah.
5. Buka menu Audit Log buat lihat catatan semua yang barusan terjadi.
6. Kalau penasaran sama fitur admin, login pakai akun admin dan coba tambah/ubah user di sana.

## Soal reCAPTCHA

Aplikasi ini tetap jalan normal walau kamu belum pasang key reCAPTCHA — dianggap nonaktif
begitu saja. Kalau kamu sudah punya key (dari https://www.google.com/recaptcha/admin), tinggal
isi:

- Kalau pakai Cara 1 (Docker): isi di file `.env` yang di folder paling luar, terus jalankan
  ulang `docker compose up --build`.
- Kalau pakai Cara 2 (manual): isi `RECAPTCHA_SECRET_KEY` di `.env`-nya `stock-opname-be`, dan
  `NUXT_PUBLIC_RECAPTCHA_SITE_KEY` di `.env`-nya `stock-opname-fe`, terus restart dua-duanya.

Tidak perlu ubah kode apa-apa, begitu key-nya keisi langsung aktif sendiri.

## Kalau ada yang error

- **Backend error nyambung ke database** — biasanya database-nya belum siap atau belum nyala.
  Cek dulu dengan `docker compose ps`, pastikan Postgres-nya statusnya sudah "healthy".
- **"Port sudah dipakai"** — ada aplikasi lain di komputermu yang kebetulan pakai port yang
  sama (3000, 4000, atau 5432). Cek pakai `lsof -i :3000` (ganti angkanya sesuai port yang
  bentrok), lalu matikan aplikasi itu atau ganti port di `.env`.
- **Login gagal terus padahal yakin password-nya benar** — kemungkinan akunnya lagi ke-lock
  karena salah password 3 kali berturut-turut (otomatis lock 15 menit). Login pakai akun admin,
  buka menu Users, cari akun yang ke-lock, klik Unlock.
- **Muncul pesan "Missing reCAPTCHA token"** — berarti key di backend sudah diisi tapi key di
  frontend belum (atau salah pasangan). Pastikan dua-duanya dari site reCAPTCHA yang sama.
- **Data yang sudah dibuat hilang semua** — kemungkinan kamu tidak sengaja menjalankan
  `docker compose down -v`, flag `-v` itu yang menghapus data databasenya.
- **Sudah ubah kode tapi tidak ada perubahan (pas pakai Cara 1/Docker)** — Docker jalan dari
  hasil build, bukan dari kode langsung. Jalankan `docker compose up --build` lagi supaya
  kodenya ke-build ulang.
