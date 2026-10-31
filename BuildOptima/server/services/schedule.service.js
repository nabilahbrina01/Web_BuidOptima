const prisma = require('../config/prisma');
const dayjs  = require('dayjs');

const ID_TO_EN = { Senin: 'monday', Selasa: 'tuesday', Rabu: 'wednesday', Kamis: 'thursday', Jumat: 'friday', Sabtu: 'saturday', Minggu: 'sunday' };
const EN_TO_ID = { monday: 'Senin', tuesday: 'Selasa', wednesday: 'Rabu', thursday: 'Kamis', friday: 'Jumat', saturday: 'Sabtu', sunday: 'Minggu' };

const toDbDay = (day) => ID_TO_EN[day] || day; // accept either form, store English
const toUiDay = (day) => EN_TO_ID[day] || day;

const toDbTime = (t) => (t && t.length === 5 ? `${t}:00` : t);
const toUiTime = (t) => (t && t.endsWith(':00') && t.length === 8 ? t.slice(0, 5) : t);

const computeStatus = (s) => {
  const now = dayjs();
  const todayDbDay = now.format('dddd').toLowerCase();
  if (s.day !== todayDbDay) return 'upcoming'; // not today -> treat as upcoming
  const nowTime = now.format('HH:mm:ss');
  if (nowTime < s.start_time) return 'upcoming';
  if (nowTime > s.end_time) return 'done';
  return 'ongoing';
};

const enrichSchedule = (s) => ({
  ...s,
  course:      s.course_name,
  supervisor:  s.lecturer,
  day:         toUiDay(s.day),
  start_time:  toUiTime(s.start_time),
  end_time:    toUiTime(s.end_time),
  status:      computeStatus(s),
  room_code:   s.room?.room_code ?? null,
  room_name:   s.room?.room_name ?? null,
});

/**
 * Check for scheduling conflicts.
 * Two schedules conflict if they are in the same room on the same day and their time windows overlap.
 * NOTE: day/startTime/endTime here must already be in DB format (English day, HH:mm:ss).
 */
// Mengembalikan jadwal yang bentrok (atau null) supaya pesan errornya bisa menyebut jadwal mana.
const hasConflict = async (roomId, day, startTime, endTime, excludeId = null) => {
  const schedules = await prisma.schedule.findMany({
    where: {
      room_id: parseInt(roomId, 10),
      day,
      id: excludeId ? { not: parseInt(excludeId, 10) } : undefined,
    },
    include: { room: { select: { room_code: true } } },
  });

  return schedules.find((s) => startTime < s.end_time && endTime > s.start_time) || null;
};

const conflictMessage = (s) =>
  `Jadwal bentrok! Ruangan ${s.room?.room_code ?? ''} sudah dipakai "${s.course_name}" pada ${toUiDay(s.day)} ${toUiTime(s.start_time)}–${toUiTime(s.end_time)}.`;

const assertTimeRange = (start, end) => {
  if (!start || !end || start >= end) throw { status: 400, message: 'Waktu selesai harus lebih besar dari waktu mulai.' };
};

const getAll = async ({ roomId, day } = {}) => {
  const where = {};
  if (roomId) where.room_id = parseInt(roomId, 10);
  if (day)    where.day = toDbDay(day);

  const schedules = await prisma.schedule.findMany({
    where,
    include: { room: { select: { room_code: true, room_name: true, floor: true } } },
    orderBy: [{ day: 'asc' }, { start_time: 'asc' }],
  });
  return schedules.map(enrichSchedule);
};

const getById = async (id) => {
  const s = await prisma.schedule.findUnique({
    where: { id: parseInt(id, 10) },
    include: { room: true },
  });
  if (!s) throw { status: 404, message: 'Schedule not found' };
  return enrichSchedule(s);
};

const create = async (data) => {
  const course_name = data.course_name || data.course;
  const lecturer     = data.lecturer || data.supervisor;
  if (!course_name) throw { status: 400, message: 'Course name is required' };
  if (!data.room_id) throw { status: 400, message: 'Room is required' };

  const day        = toDbDay(data.day);
  const start_time = toDbTime(data.start_time);
  const end_time    = toDbTime(data.end_time);

  assertTimeRange(start_time, end_time);
  const conflict = await hasConflict(data.room_id, day, start_time, end_time);
  if (conflict) throw { status: 409, message: conflictMessage(conflict) };

  const created = await prisma.schedule.create({
    data: {
      room_id: parseInt(data.room_id, 10),
      course_name,
      lecturer: lecturer || '-',
      day,
      start_time,
      end_time,
    },
    include: { room: true },
  });
  return enrichSchedule(created);
};

const update = async (id, data) => {
  const existing = await prisma.schedule.findUnique({ where: { id: parseInt(id, 10) } });
  if (!existing) throw { status: 404, message: 'Schedule not found' };

  const roomId     = data.room_id !== undefined ? data.room_id : existing.room_id;
  const day        = data.day !== undefined ? toDbDay(data.day) : existing.day;
  const start_time = data.start_time !== undefined ? toDbTime(data.start_time) : existing.start_time;
  const end_time   = data.end_time !== undefined ? toDbTime(data.end_time) : existing.end_time;

  assertTimeRange(start_time, end_time);
  const conflict = await hasConflict(roomId, day, start_time, end_time, id);
  if (conflict) throw { status: 409, message: conflictMessage(conflict) };

  const updateData = { room_id: parseInt(roomId, 10), day, start_time, end_time };
  if (data.course_name !== undefined || data.course !== undefined) updateData.course_name = data.course_name ?? data.course;
  if (data.lecturer !== undefined || data.supervisor !== undefined) updateData.lecturer = data.lecturer ?? data.supervisor;

  const updated = await prisma.schedule.update({
    where: { id: parseInt(id, 10) },
    data: updateData,
    include: { room: true },
  });
  return enrichSchedule(updated);
};

const remove = async (id) => {
  const s = await prisma.schedule.findUnique({ where: { id: parseInt(id, 10) } });
  if (!s) throw { status: 404, message: 'Schedule not found' };
  await prisma.schedule.delete({ where: { id: parseInt(id, 10) } });
};

const checkConflicts = async ({ roomId, day, startTime, endTime, excludeId }) => {
  const c = await hasConflict(roomId, toDbDay(day), toDbTime(startTime), toDbTime(endTime), excludeId);
  return { conflict: !!c, message: c ? conflictMessage(c) : null };
};

module.exports = { getAll, getById, create, update, remove, checkConflicts };