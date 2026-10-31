# BuildOptima — Frontend

## Menjalankan

```bash
npm install
npm run dev
```

Buka **http://localhost:5173**.

Login: username **admin** atau **staff**, password **12345678**.

## Menyambungkan ke Backend

Edit `.env`:

```env
VITE_API_MODE=real
VITE_API_BASE_URL=http://alamat-backend/api
VITE_WS_URL=ws://alamat-backend/ws
```

## Struktur

```
src/
├── api/          klien REST (mock & real)
├── ws/           koneksi WebSocket
├── context/      Auth, Data, Toast
├── components/   Sidebar, Topbar, Modal, dll
├── pages/        halaman aplikasi
└── index.css
```
