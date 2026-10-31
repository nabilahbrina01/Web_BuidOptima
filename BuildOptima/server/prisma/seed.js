/**
 * BuildOptima - Prisma Seed
 * Populates the database with realistic demo data for development/testing.
 * Run: node prisma/seed.js  OR  npm run prisma:seed
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding BuildOptima database…');

  // ─── USERS ─────────────────────────────────────────────────────────────────
const adminPw = await bcrypt.hash('12345678', 12);
const staffPw = await bcrypt.hash('12345678', 12);

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@buildoptima.id' },
    update: { name: 'Administrator', email_verified: true },
    create: {
      username: 'admin',
      email:    'admin@buildoptima.id',
      password: adminPw,
      role:     'admin',
      name:     'Administrator',
      email_verified: true,
    },
  });

  const staff = await prisma.user.upsert({
    where:  { email: 'staff@buildoptima.id' },
    update: { name: 'Staff Teknisi', email_verified: true },
    create: {
      username: 'staff',
      email:    'staff@buildoptima.id',
      password: staffPw,
      role:     'staff',
      name:     'Staff Teknisi',
      email_verified: true,
    },
  });

  console.log('  ✓ Users seeded');

  // ─── ROOMS ─────────────────────────────────────────────────────────────────
  const roomsData = [
    { room_code: 'R101', room_name: 'Lab Komputer 1',     floor: 1 },
    { room_code: 'R102', room_name: 'Lab Komputer 2',     floor: 1 },
    { room_code: 'R201', room_name: 'Ruang Kuliah A',     floor: 2 },
    { room_code: 'R202', room_name: 'Ruang Kuliah B',     floor: 2 },
    { room_code: 'R301', room_name: 'Lab Jaringan',       floor: 3 },
    { room_code: 'R302', room_name: 'Ruang Seminar',      floor: 3 },
  ];

  const rooms = [];
  for (const r of roomsData) {
    const room = await prisma.room.upsert({
      where:  { room_code: r.room_code },
      update: {},
      create: r,
    });
    rooms.push(room);
  }
  console.log('  ✓ Rooms seeded');

  // ─── DEVICES ───────────────────────────────────────────────────────────────
  const devicesData = [
    { esp_id: 'ESP32_R101_01', room_id: rooms[0].id, device_name: 'ESP32 Lab Komputer 1' },
    { esp_id: 'ESP32_R102_01', room_id: rooms[1].id, device_name: 'ESP32 Lab Komputer 2' },
    { esp_id: 'ESP32_R201_01', room_id: rooms[2].id, device_name: 'ESP32 Ruang Kuliah A' },
    { esp_id: 'ESP32_R202_01', room_id: rooms[3].id, device_name: 'ESP32 Ruang Kuliah B' },
    { esp_id: 'ESP32_R301_01', room_id: rooms[4].id, device_name: 'ESP32 Lab Jaringan'   },
    { esp_id: 'ESP32_R302_01', room_id: rooms[5].id, device_name: 'ESP32 Ruang Seminar'  },
  ];

  const devices = [];
  for (const d of devicesData) {
    const device = await prisma.device.upsert({
      where:  { esp_id: d.esp_id },
      update: {},
      create: d,
    });
    devices.push(device);
  }
  console.log('  ✓ Devices seeded');

  // ─── SENSORS ───────────────────────────────────────────────────────────────
  const sensorTypes = [
    { sensor_type: 'mmwave',       unit: 'presence' },
    { sensor_type: 'dht22_temp',   unit: '°C'       },
    { sensor_type: 'dht22_hum',    unit: '%'        },
    { sensor_type: 'pzem_voltage', unit: 'V'        },
    { sensor_type: 'pzem_current', unit: 'A'        },
    { sensor_type: 'pzem_power',   unit: 'W'        },
  ];

  for (const device of devices) {
    for (const st of sensorTypes) {
      const existing = await prisma.sensor.findFirst({
        where: { device_id: device.id, sensor_type: st.sensor_type },
      });
      if (!existing) {
        await prisma.sensor.create({ data: { device_id: device.id, ...st } });
      }
    }
  }
  console.log('  ✓ Sensors seeded');

  // ─── ACTUATORS ─────────────────────────────────────────────────────────────
  for (const device of devices) {
    const existing = await prisma.actuator.findFirst({ where: { device_id: device.id } });
    if (!existing) {
      await prisma.actuator.createMany({
        data: [
          { device_id: device.id, actuator_name: 'Relay AC',    status: 'off' },
          { device_id: device.id, actuator_name: 'Relay Lampu', status: 'off' },
          { device_id: device.id, actuator_name: 'IR AC',       status: 'off' },
        ],
      });
    }
  }
  console.log('  ✓ Actuators seeded');

  // ─── SCHEDULES ─────────────────────────────────────────────────────────────
  const schedules = [
    { room_id: rooms[0].id, course_name: 'Pemrograman Lanjut',      lecturer: 'Dr. Budi Santoso',    day: 'monday',    start_time: '07:00:00', end_time: '09:30:00' },
    { room_id: rooms[0].id, course_name: 'Sistem Operasi',           lecturer: 'Prof. Siti Rahayu',   day: 'monday',    start_time: '10:00:00', end_time: '12:00:00' },
    { room_id: rooms[1].id, course_name: 'Jaringan Komputer',        lecturer: 'Dr. Ahmad Fauzi',     day: 'tuesday',   start_time: '07:00:00', end_time: '09:30:00' },
    { room_id: rooms[2].id, course_name: 'Kalkulus Lanjut',          lecturer: 'Dr. Dewi Kurniasih',  day: 'wednesday', start_time: '13:00:00', end_time: '15:30:00' },
    { room_id: rooms[3].id, course_name: 'Basis Data',               lecturer: 'Prof. Eko Prasetyo',  day: 'thursday',  start_time: '09:00:00', end_time: '11:30:00' },
    { room_id: rooms[4].id, course_name: 'Keamanan Jaringan',        lecturer: 'Dr. Fitri Handayani', day: 'friday',    start_time: '07:00:00', end_time: '09:30:00' },
    { room_id: rooms[5].id, course_name: 'Seminar Tugas Akhir',      lecturer: 'Prof. Gunawan',       day: 'saturday',  start_time: '08:00:00', end_time: '12:00:00' },
  ];

  for (const s of schedules) {
    const exists = await prisma.schedule.findFirst({
      where: { room_id: s.room_id, day: s.day, start_time: s.start_time },
    });
    if (!exists) await prisma.schedule.create({ data: s });
  }
  console.log('  ✓ Schedules seeded');

  // ─── ASSETS ────────────────────────────────────────────────────────────────
  const assetCategories = [
    { asset_name: 'PC Desktop',       category: 'Elektronik', condition: 'good'    },
    { asset_name: 'Proyektor Epson',  category: 'Elektronik', condition: 'good'    },
    { asset_name: 'AC Daikin 1 PK',   category: 'Elektronik', condition: 'good'    },
    { asset_name: 'Meja Mahasiswa',   category: 'Furniture',  condition: 'good'    },
    { asset_name: 'Kursi Mahasiswa',  category: 'Furniture',  condition: 'good'    },
    { asset_name: 'Whiteboard',       category: 'Furniture',  condition: 'damaged' },
  ];
  // Frontend membaca condition_status (Baik / Ada Yang Rusak / Rusak), bukan enum `condition`
  const STATUS_OF = { good: 'Baik', damaged: 'Ada Yang Rusak', missing: 'Rusak' };

  for (const room of rooms) {
    for (const a of assetCategories) {
      const exists = await prisma.asset.findFirst({
        where: { room_id: room.id, asset_name: a.asset_name },
      });
      if (!exists) {
        const created = await prisma.asset.create({
          data: { ...a, condition_status: STATUS_OF[a.condition], room_id: room.id },
        });
        await prisma.asset.update({
          where: { id: created.id },
          data: { qr_code: `SB-${new Date().getFullYear()}-${String(created.id).padStart(3, '0')}` },
        });
      }
    }
  }
  console.log('  ✓ Assets seeded');

  // ─── NOTIFICATIONS ─────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { title: 'System Started',      message: 'BuildOptima backend initialized successfully.', type: 'system'          },
      { title: 'Device Online',       message: 'ESP32 R101 is now online.',                     type: 'system'          },
      { title: 'Energy Alert',        message: 'Lab Komputer 1: high power usage detected.',     type: 'energy_anomaly'  },
      { title: 'Room Occupied',       message: 'Ruang Kuliah A is now occupied.',                type: 'occupancy_alert' },
    ],
    skipDuplicates: true,
  });
  console.log('  ✓ Notifications seeded');

  console.log('\n✅ Seed complete!');
  console.log('   Admin login  → admin  / 12345678');
  console.log('   Staff login  → staff  / 12345678');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
