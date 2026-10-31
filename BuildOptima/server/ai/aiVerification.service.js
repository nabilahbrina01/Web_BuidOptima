const prisma = require('../config/prisma');
const path   = require('path');

const runDetection = async (imagePath) => {
  const MOCK_OBJECTS = [
    { label: 'chair',       confidence: 0.92, count: 4  },
    { label: 'table',       confidence: 0.97, count: 2  },
    { label: 'projector',   confidence: 0.88, count: 1  },
    { label: 'whiteboard',  confidence: 0.95, count: 1  },
    { label: 'air_conditioner', confidence: 0.91, count: 1 },
  ];

  await new Promise(r => setTimeout(r, 500));

  return MOCK_OBJECTS;
};

// ─── COMPARISON LOGIC ─────────────────────────────────────────────────────────
const compareWithInventory = (detected, expected) => {
  const detectedMap = {};
  detected.forEach(d => { detectedMap[d.label.toLowerCase()] = d.count; });

  let mismatchCount = 0;
  const report = expected.map(item => {
    const detectedCount = detectedMap[item.asset_name.toLowerCase()] || 0;
    const match         = detectedCount === 1; // 1 per category per room assumption
    if (!match) mismatchCount++;
    return {
      asset_name:     item.asset_name,
      category:       item.category,
      expected_count: 1,
      detected_count: detectedCount,
      status:         match ? 'match' : 'mismatch',
    };
  });

  return { report, mismatchCount };
};

// ─── VERIFY ───────────────────────────────────────────────────────────────────
const verify = async (roomId, imageFile) => {
  const room = await prisma.room.findUnique({ where: { id: parseInt(roomId, 10) } });
  if (!room) throw { status: 404, message: 'Room not found' };

  const imageUrl = imageFile
    ? `uploads/images/${path.basename(imageFile.path)}`
    : null;

  if (!imageUrl) throw { status: 400, message: 'Image file required' };

  // Run detection (mock or real)
  const detectedObjects = await runDetection(imageFile.path);

  // Fetch expected assets from DB
  const dbAssets = await prisma.asset.findMany({
    where: { room_id: parseInt(roomId, 10), status: 'active' },
    select: { asset_name: true, category: true },
  });

  const { report, mismatchCount } = compareWithInventory(detectedObjects, dbAssets);

  const result = await prisma.inventoryAiResult.create({
    data: {
      room_id:          parseInt(roomId, 10),
      image_url:        imageUrl,
      detected_objects: JSON.stringify(detectedObjects),
      expected_objects: JSON.stringify(report),
      mismatch_count:   mismatchCount,
    },
  });

  return { ...result, detected_objects: detectedObjects, expected_objects: report };
};

const getHistory = async (roomId) => {
  const where = roomId ? { room_id: parseInt(roomId, 10) } : {};
  const results = await prisma.inventoryAiResult.findMany({
    where,
    include: { room: { select: { room_code: true, room_name: true } } },
    orderBy: { created_at: 'desc' },
    take: 50,
  });

  return results.map(r => ({
    ...r,
    detected_objects: JSON.parse(r.detected_objects),
    expected_objects: JSON.parse(r.expected_objects),
  }));
};

module.exports = { verify, getHistory };
