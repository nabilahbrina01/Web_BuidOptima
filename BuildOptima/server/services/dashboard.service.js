const prisma = require('../config/prisma');
const dayjs  = require('dayjs');

const getSummary = async () => {
  const [
    totalRooms,
    occupiedRooms,
    totalDevices,
    onlineDevices,
    unreadNotifications,
    todayEnergy,
  ] = await Promise.all([
    prisma.room.count(),
    prisma.room.count({ where: { occupancy_status: 'occupied' } }),
    prisma.device.count(),
    prisma.device.count({ where: { status: 'online' } }),
    prisma.notification.count({ where: { is_read: false } }),
    prisma.energyLog.aggregate({
      where: { recorded_at: { gte: dayjs().startOf('day').toDate() } },
      _sum: { energy_kwh: true, estimated_cost: true },
    }),
  ]);

  return {
    rooms: {
      total:    totalRooms,
      occupied: occupiedRooms,
      empty:    totalRooms - occupiedRooms,
    },
    devices: {
      total:   totalDevices,
      online:  onlineDevices,
      offline: totalDevices - onlineDevices,
    },
    notifications: {
      unread: unreadNotifications,
    },
    energy: {
      today_kwh:  parseFloat(todayEnergy._sum.energy_kwh || 0),
      today_cost: parseFloat(todayEnergy._sum.estimated_cost || 0),
    },
  };
};

module.exports = { getSummary };
