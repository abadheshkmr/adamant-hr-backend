import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

const SettingsModel = mongoose.models.settings || mongoose.model('settings', settingsSchema);

export default SettingsModel;
