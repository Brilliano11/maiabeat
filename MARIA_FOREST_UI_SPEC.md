# Maiabeat - Maria Forest Dominan Merah UI Specification

## 1. Status Dokumen

- Nama tema: **Maria Forest**
- Theme key: `maria`
- Status: design source of truth
- Referensi: mockup Maria Forest dominan merah dengan background hitam dan crimson yang lembut
- Catatan: versi meadow green dominan sudah digantikan oleh arahan dominan merah

Dokumen ini menjelaskan tampilan Maria Forest untuk seluruh halaman Maiabeat. Fitur,
API, autentikasi, queue, Spotify playback, dan data Supabase tetap menggunakan logic
yang sudah ada.

## 2. Arah Visual

Maria Forest adalah tema dark earthy yang tenang, hangat, dan rendah kontras secara
dekoratif. Tema tetap harus mempunyai kontras teks yang cukup untuk dibaca.

Karakter utama:

- Background hitam seperti aplikasi musik modern.
- Deep crimson dan wine menjadi aksen utama.
- Outerspace, meadow green, dan dusty olive dipakai sebagai warna pendamping.
- Heading dan interface memakai Playfair Display agar sama dengan karakter contoh.
- Border moss tipis menggantikan border hitam pekat.
- Shadow kecil dan lembut menggantikan shadow brutal yang tebal.
- Tidak memakai warna neon, glow, gradient, atau putih murni.

## 3. Color Tokens

| Token | Hex | Penggunaan |
| --- | --- | --- |
| `--mf-bg` | `#121212` | Background halaman |
| `--mf-sidebar` | `#0A0D0B` | Sidebar dan area navigasi |
| `--mf-surface` | `#211719` | Card, input, dan panel |
| `--mf-surface-raised` | `#2D1E21` | Hover dan panel elevated |
| `--mf-primary` | `#7B2E3A` | Active navigation dan primary action |
| `--mf-primary-hover` | `#8A3946` | Hover primary action |
| `--mf-accent` | `#68000C` | Progress, repeat, volume, dan highlight pendamping |
| `--mf-outerspace` | `#344B4E` | Accent sekunder dan genre tertentu |
| `--mf-danger` | `#963E4C` | Error, logout, delete, dan destructive action |
| `--mf-text` | `#E8E1D2` | Teks utama |
| `--mf-text-muted` | `#BBA9A8` | Metadata dan teks sekunder |
| `--mf-border` | `#5B3A3F` | Border komponen |
| `--mf-focus` | `#C58D95` | Keyboard focus ring |
| `--mf-disabled` | `#596159` | Disabled state |
| `--mf-shadow` | `#080A09` | Shadow kecil |

Rekomendasi distribusi visual:

- 60% near-black dan charcoal.
- 25% deep crimson dan wine.
- 10% muted red surface.
- 5% outerspace, olive, dan meadow green.

## 4. CSS Theme Contract

```css
[data-theme="maria"] {
  color-scheme: dark;

  --app-bg: #121212;
  --nav-bg: #0a0d0b;
  --surface: #211719;
  --surface-raised: #2d1e21;
  --primary: #7b2e3a;
  --primary-hover: #8a3946;
  --accent: #68000c;
  --secondary: #344b4e;
  --danger: #963e4c;
  --text-primary: #e8e1d2;
  --text-secondary: #bba9a8;
  --border-color: #5b3a3f;
  --focus-ring: #c58d95;
  --disabled: #596159;
  --shadow-color: #080a09;

  --border-width: 2px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --shadow-sm: 3px 3px 0 var(--shadow-color);
}
```

Komponen tidak boleh memakai warna hardcoded seperti `bg-[#FFD600]`,
`border-black`, atau `text-black` ketika tema Maria aktif. Semua warna harus melalui
semantic token.

## 5. Typography

### Display

Dipakai untuk page title, nama album, nama artis, dan heading besar.

```css
font-family: var(--font-maria-display), Georgia, "Times New Roman", serif;
font-weight: 700;
letter-spacing: 0;
```

### Interface

Playfair Display juga dipakai untuk navigasi, tombol, input, metadata, tabel, dan
kontrol player agar karakter tipografi sama dengan contoh dominan merah.

```css
font-family: var(--font-maria-display), Georgia, serif;
font-weight: 600;
letter-spacing: 0;
```

Ukuran dasar:

| Elemen | Desktop | Mobile |
| --- | --- | --- |
| Page title | `48px` | `32px` |
| Section title | `24px` | `20px` |
| Card title | `16px` | `15px` |
| Body | `14px` | `14px` |
| Metadata | `12px` | `12px` |

Font tidak boleh diskalakan berdasarkan lebar viewport.

## 6. Shape, Border, dan Shadow

- Card radius maksimal `8px`.
- Input dan tombol radius `6px` sampai `8px`.
- Border utama `2px solid var(--border-color)`.
- Divider tabel menggunakan border `1px` dengan opacity rendah.
- Shadow maksimal `3px 3px 0 var(--shadow-color)`.
- Hover tidak boleh mengubah ukuran atau posisi layout.
- Tidak menggunakan pill untuk command biasa.
- Pill hanya digunakan untuk filter, status, dan segmented control.

## 7. Desktop Layout

### Sidebar

- Lebar stabil: `248px` sampai `264px`.
- Posisi fixed di kiri.
- Tinggi `100dvh`.
- Background `--nav-bg`.
- Active item menggunakan deep crimson `--primary`.
- Logout menggunakan crimson terang `--danger`.
- Badge `MARIA FOREST` berada di bagian bawah.
- Sidebar tidak ikut bergerak ketika content di-scroll.

### Main Content

- Margin kiri mengikuti lebar sidebar.
- Padding desktop `24px` sampai `32px`.
- Content dapat di-scroll sendiri.
- Lebar section mengikuti viewport dan tidak menggunakan hero marketing.
- Gap memakai skala `8px`, `12px`, `16px`, `24px`, dan `32px`.

### Bottom Player

- Fixed di bawah area content, bukan di bawah sidebar.
- Tinggi stabil `80px` sampai `88px`.
- Background campuran `--surface` dan wine gelap.
- Play button memakai deep crimson atau `--accent` sesuai hierarki.
- Progress memakai `--accent`, track memakai `--border-color`.
- Thumbnail, judul, kontrol, progress, volume, dan queue tidak boleh bergeser.

## 8. Mobile Layout

Breakpoint utama: `768px`.

- Sidebar desktop disembunyikan.
- Bottom navigation fixed ditampilkan.
- Urutan navigation: Home, Search, Player, Library.
- Mini player berada tepat di atas bottom navigation.
- Content memiliki bottom padding yang mencakup mini player, navbar, dan safe area.
- Touch target minimal `44px`.
- Tidak boleh ada horizontal overflow.
- Text panjang memakai ellipsis maksimal dua baris.
- Modal desktop berubah menjadi bottom sheet atau fullscreen dialog.

Struktur area fixed:

```text
Scrollable page content
-----------------------
Mini player
Bottom navigation
Device safe area
```

## 9. Component Rules

### Buttons

- Primary: meadow green, warm ivory text.
- Secondary: charcoal surface, moss border.
- Accent/play: dusty olive, dark foreground.
- Danger: crimson hanya untuk destructive command.
- Icon-only button wajib memiliki tooltip dan accessible label.

### Inputs

- Background `--surface`.
- Border `--border-color`.
- Placeholder menggunakan `--text-secondary`.
- Focus ring `2px solid --focus-ring`.
- Tidak mengubah ukuran saat focus.

### Cards

- Background default `--surface`.
- Hover `--surface-raised`.
- Mood card boleh memakai meadow, olive, atau outerspace yang digelapkan.
- Maksimal satu crimson card dalam satu kelompok genre.

### Tables dan Track Rows

- Dense tetapi tetap mudah dipindai.
- Thumbnail berukuran tetap.
- Kolom title fleksibel, kolom duration tetap.
- Hover hanya mengubah surface.
- Reorder menggunakan grip icon.
- Remove menggunakan icon `X` atau trash dengan tooltip.

### Segmented Theme Control

Settings menggunakan tiga pilihan:

```text
SUNNY | NIGHT | MARIA FOREST
```

- Pilihan aktif memiliki background `--primary`.
- Tema disimpan di local storage.
- Refresh tidak boleh mengembalikan tema ke Sunny.

## 10. Page Specifications

### Home

- Greeting dan Spotify connection status.
- Continue Listening horizontal row.
- Recently Played.
- Quick Access.
- Player tetap terlihat ketika content di-scroll.

### Search

- Search input menjadi kontrol utama.
- Recent searches dan clear command.
- Filter menggunakan icon button atau menu.
- Hasil dipisahkan menjadi Songs, Artists, Albums, dan Playlists.
- Track result memakai row compact, bukan card besar.

### Explore

- Heading serif.
- Grid mood dan genre stabil tiga kolom desktop.
- Mobile memakai dua kolom.
- Meadow, olive, dan outerspace mendominasi tiles.
- Crimson menjadi warna mayoritas tile; outerspace dan olive menjadi jeda visual.

### Genre Detail

- Header compact dengan cover, nama, metadata, play, dan shuffle.
- Tidak memakai hero full viewport.
- Track table berada langsung setelah header.

### Player

- Album cover besar tetapi tidak memenuhi seluruh viewport.
- Informasi lagu dan playback controls menjadi fokus.
- Up Next compact di desktop.
- Up Next collapsible di mobile.
- Spotify state tidak boleh reset ketika tema berubah.

### Lyrics

- Background tetap charcoal, bukan warna terang.
- Active lyric memakai warm ivory.
- Inactive lyric memakai sage gray dengan opacity bertingkat.
- Fullscreen tetap mempertahankan kontrol keluar yang jelas.

### Queue

- Pisahkan Now Playing dan Next Up.
- Reorder, remove, dan clear queue tersedia.
- Row memiliki dimensi stabil.
- Tema tidak boleh mengubah urutan queue.

### Library

- Tabs: Playlists, Artists, Albums, Liked.
- Search dan sort terlihat jelas.
- Create playlist menggunakan icon plus.
- Desktop dapat memakai card dan table hybrid.
- Mobile memakai compact list.

### Liked Songs

- Header compact dengan heart, jumlah lagu, play, dan shuffle.
- Search in liked songs.
- Track table/list menjadi konten utama.

### Playlist Detail

- Cover, nama, description, privacy, metadata.
- Play All, Shuffle, Edit.
- Track rows mendukung reorder dan remove.
- Edit details memakai modal desktop dan bottom sheet mobile.

### Album Detail

- Album artwork, artist, year, dan track count.
- Play, Shuffle, Save.
- Track list menggunakan row compact.

### Artist Detail

- Portrait jelas dan tidak terlalu besar.
- Popular tracks, Discography, Related Artists.
- Tidak memakai marketing hero.

### Profile

- Identitas user dan Spotify connection status.
- Listening statistics.
- Top genres.
- Account actions.
- Logout tetap crimson tetapi tidak dominan.

### Settings

- Theme segmented control.
- Palette preview Maria Forest.
- Playback preferences memakai toggle.
- Data/storage controls.
- API status dan About.
- Tidak memakai card di dalam card.

### Login

- Brand langsung terlihat.
- Form compact dan fokus pada autentikasi.
- Email, password, remember me, login, dan create account link.
- Tidak memakai hero atau ilustrasi dekoratif.

### Register

- Name, email, password, confirm password.
- Validation state jelas.
- Primary action meadow green.
- Link kembali ke Login.

## 11. Interaction States

| State | Tampilan |
| --- | --- |
| Default | Charcoal surface dan moss border |
| Hover | Surface raised tanpa layout shift |
| Active | Meadow green |
| Focus | Dusty rose focus ring |
| Disabled | Muted gray-green dan cursor disabled |
| Loading | Skeleton charcoal dengan animasi halus |
| Success | Meadow indicator |
| Warning | Dusty olive |
| Error | Crimson terbatas |

Animation menggunakan durasi `120ms` sampai `200ms`. Hindari bounce, glow, dan
pergerakan dekoratif berlebihan.

## 12. Implementation Boundaries

Implementasi Maria Forest hanya boleh mengubah:

- Theme state dan persistence.
- Semantic color tokens.
- Typography.
- Spacing dan responsive layout.
- Visual component states.
- Icon placement.

Implementasi tidak boleh mengubah:

- Spotify OAuth.
- Supabase schema atau RLS.
- Queue ordering logic.
- Playback synchronization.
- Playlist data contract.
- API response format.
- Authentication behavior.

`SpotifyPlayerProvider` harus tetap berada pada posisi yang stabil dan tidak boleh
remount hanya karena user mengganti tema.

## 13. Accessibility

- Decorative contrast boleh rendah, text contrast tidak boleh rendah.
- Body text minimal memenuhi WCAG AA.
- Semua kontrol dapat digunakan dengan keyboard.
- Focus state selalu terlihat.
- Icon-only action memiliki accessible name.
- Tidak mengandalkan warna sebagai satu-satunya penanda status.
- Reduced-motion preference harus dihormati.

## 14. Acceptance Checklist

- [ ] Sunny, Night, dan Maria Forest dapat dipilih dari Settings.
- [ ] Maria Forest bertahan setelah refresh dan login ulang.
- [ ] Tidak ada warna Sunny hardcoded yang muncul pada Maria Forest.
- [ ] Sidebar desktop tetap fixed ketika content di-scroll.
- [ ] Mini player dan bottom navigation tidak overlap di mobile.
- [ ] Current song dan queue tidak reset ketika tema berganti.
- [ ] Semua halaman mengikuti token Maria Forest.
- [ ] Crimson menjadi warna dominan tanpa mengurangi keterbacaan.
- [ ] Tidak ada gradient, glow, neon, atau pure-white card.
- [ ] Tidak ada horizontal overflow pada lebar 320px.
- [ ] Text panjang tidak keluar dari container.
- [ ] Dialog dapat ditutup dengan Escape dan memiliki focus trap.
- [ ] Lint, TypeScript, build, dan E2E lulus.
- [ ] Screenshot desktop dan mobile sesuai mockup Maria Forest dominan merah.

## 15. Recommended Delivery Flow

1. Buat branch `codex/maria-forest-ui`.
2. Tambahkan theme enum dan persistence.
3. Definisikan semantic tokens untuk ketiga tema.
4. Migrasikan komponen global sebelum halaman individual.
5. Implementasikan halaman per kelompok.
6. Verifikasi desktop dan mobile.
7. Deploy ke Vercel Preview.
8. Merge ke `main` hanya setelah visual dan fungsi disetujui.
