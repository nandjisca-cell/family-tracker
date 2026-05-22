const Location = require('../models/Location');

const cleanOldLocations = async () => {
  try {
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const result = await Location.deleteMany({ timestamp: { $lt: cutoff } });
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned ${result.deletedCount} old location records`);
    }
  } catch (err) {
    console.error('Cleanup error:', err);
  }
};

module.exports = { cleanOldLocations };
