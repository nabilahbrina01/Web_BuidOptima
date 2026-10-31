const prisma = require('../config/prisma');
const dayjs  = require('dayjs');

const enrichRoom = async (room) => {
  const dayName = dayjs().format('dddd').toLowerCase(); // 'monday', 'tuesday', ...
  const nowTime = dayjs().format('HH:mm:ss');

  const activeSchedule = await prisma.schedule.findFirst({
    where: {
      room_id: room.id,
      day: dayName,
      start_time: { lte: nowTime },
      end_time: { gte: nowTime },
    },
  });

  const deviceIds = (room.devices || []).map((d) => d.id);
  let temperature = null;
  let humidity = null;

  if (deviceIds.length) {
    const [tempLog, humLog] = await Promise.all([
      prisma.sensorLog.findFirst({
        where: { sensor: { device_id: { in: deviceIds }, sensor_type: 'dht22_temp' } },
        orderBy: { recorded_at: 'desc' },
      }),
      prisma.sensorLog.findFirst({
        where: { sensor: { device_id: { in: deviceIds }, sensor_type: 'dht22_hum' } },
        orderBy: { recorded_at: 'desc' },
      }),
    ]);
    temperature = tempLog ? parseFloat(tempLog.value) : null;
    humidity    = humLog  ? parseFloat(humLog.value)  : null;
  }

  return {
    ...room,
    name:       room.room_name,
    // Aktif = terdeteksi sensor (MQTT) ATAU sedang ada jadwal berlangsung.
    status:     (room.occupancy_status === 'occupied' || !!activeSchedule) ? 'used' : 'free',
    course:     activeSchedule?.course_name || null,
    supervisor: activeSchedule?.lecturer || null,
    start_time: activeSchedule ? activeSchedule.start_time.slice(0, 5) : null,
    end_time:   activeSchedule ? activeSchedule.end_time.slice(0, 5) : null,
    temperature,
    humidity,
  };
};

const getAll = async ({ floor } = {}) => {
  const where = floor ? { floor: parseInt(floor, 10) } : {};
  const rooms = await prisma.room.findMany({
    where,
    include: {
      devices: { select: { id: true, device_name: true, status: true } },
      _count: { select: { assets: true, schedules: true } },
    },
    orderBy: [{ floor: 'asc' }, { room_code: 'asc' }],
  });
  return Promise.all(rooms.map(enrichRoom));
};

const getById = async (id) => {
  const room = await prisma.room.findUnique({
    where: { id: parseInt(id, 10) },
    include: {
      devices: { include: { sensors: true, actuators: true } },
      schedules: true,
      assets: true,
    },
  });
  if (!room) throw { status: 404, message: 'Room not found' };
  return enrichRoom(room);
};

// Frontend's Add/Edit Room form sends { id (=room code text), name, capacity, floor } —
// map those onto the real Prisma columns (room_code / room_name) here.
const create = async (data) => {
  const room_code = data.room_code || data.id;
  const room_name = data.room_name || data.name;
  if (!room_code || !room_name) throw { status: 400, message: 'Room code and name are required' };

  const exists = await prisma.room.findUnique({ where: { room_code } });
  if (exists) throw { status: 409, message: 'Room code already exists' };

  const room = await prisma.room.create({
    data: {
      room_code,
      room_name,
      floor: data.floor !== undefined ? parseInt(data.floor, 10) : 1,
      capacity: data.capacity !== undefined ? parseInt(data.capacity, 10) : 40,
    },
  });
  return enrichRoom({ ...room, devices: [] });
};

const update = async (id, data) => {
  const room = await prisma.room.findUnique({ where: { id: parseInt(id, 10) } });
  if (!room) throw { status: 404, message: 'Room not found' };

  const updateData = {};
  if (data.room_name !== undefined || data.name !== undefined) updateData.room_name = data.room_name ?? data.name;
  if (data.floor !== undefined) updateData.floor = parseInt(data.floor, 10);
  if (data.capacity !== undefined) updateData.capacity = parseInt(data.capacity, 10);

  const updated = await prisma.room.update({ where: { id: parseInt(id, 10) }, data: updateData });
  return enrichRoom({ ...updated, devices: [] });
};

const remove = async (id) => {
  const room = await prisma.room.findUnique({ where: { id: parseInt(id, 10) } });
  if (!room) throw { status: 404, message: 'Room not found' };
  await prisma.room.delete({ where: { id: parseInt(id, 10) } });
};

const updateOccupancy = async (roomId, status) => {
  return prisma.room.update({
    where: { id: parseInt(roomId, 10) },
    data: { occupancy_status: status },
  });
};

const getStatus = async () => {
  return prisma.room.findMany({
    select: {
      id: true, room_code: true, room_name: true, floor: true, occupancy_status: true,
    },
    orderBy: [{ floor: 'asc' }, { room_code: 'asc' }],
  });
};

module.exports = { getAll, getById, create, update, remove, updateOccupancy, getStatus };