import mongoose from 'mongoose';
import crypto from 'crypto';

const jobAlertSubscriptionSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  filters: {
    keyword: { type: String, default: null },
    industry: { type: mongoose.Schema.Types.ObjectId, ref: 'industries', default: null },
    city: { type: String, default: null },
    employmentTypes: [{ type: String }],
    isRemote: { type: Boolean, default: null },
  },
  frequency: {
    type: String,
    enum: ['instant', 'daily', 'weekly'],
    default: 'daily',
  },
  status: {
    type: String,
    enum: ['active', 'unsubscribed', 'bounced'],
    default: 'active',
    index: true,
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'candidates',
    default: null,
  },
  unsubscribeToken: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  lastSentAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

jobAlertSubscriptionSchema.index({ status: 1, frequency: 1, lastSentAt: 1 });

jobAlertSubscriptionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

function generateUnsubscribeToken() {
  return crypto.randomBytes(32).toString('hex');
}

const JobAlertSubscriptionModel =
  mongoose.models.job_alert_subscriptions ||
  mongoose.model('job_alert_subscriptions', jobAlertSubscriptionSchema);

export { generateUnsubscribeToken };
export default JobAlertSubscriptionModel;
