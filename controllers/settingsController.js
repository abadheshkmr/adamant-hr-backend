import SettingsModel from '../models/settingsModel.js';

const SHOW_CAREER_LINK_KEY = 'showCareerLink';

/**
 * GET /api/settings
 * Returns public settings (e.g. showCareerLink). No auth required.
 */
export async function getSettings(req, res) {
  try {
    const doc = await SettingsModel.findOne({ key: SHOW_CAREER_LINK_KEY }).lean();
    const showCareerLink = doc === null ? true : doc.value === true;
    return res.json({
      success: true,
      data: { showCareerLink },
    });
  } catch (err) {
    console.error('[getSettings]', err?.message);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch settings.' });
  }
}

/**
 * PATCH /api/settings
 * Update settings. Admin only.
 * Body: { showCareerLink: boolean }
 */
export async function updateSettings(req, res) {
  try {
    const { showCareerLink } = req.body || {};
    if (typeof showCareerLink !== 'boolean') {
      return res.status(400).json({ success: false, message: 'showCareerLink must be a boolean.' });
    }
    await SettingsModel.findOneAndUpdate(
      { key: SHOW_CAREER_LINK_KEY },
      { $set: { value: showCareerLink } },
      { upsert: true, new: true }
    );
    return res.json({
      success: true,
      data: { showCareerLink },
      message: 'Settings updated.',
    });
  } catch (err) {
    console.error('[updateSettings]', err?.message);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to update settings.' });
  }
}
