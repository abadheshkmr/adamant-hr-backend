import JobAlertSubscriptionModel, {
  generateUnsubscribeToken,
} from '../models/jobAlertSubscriptionModel.js';

/** POST /api/job-alert/subscribe - Create a new job alert subscription */
export async function subscribe(req, res) {
  try {
    const { email, keyword, industry, city, employmentTypes, isRemote, frequency } =
      req.body || {};

    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required',
      });
    }

    const freq = ['instant', 'daily', 'weekly'].includes(frequency)
      ? frequency
      : 'daily';

    const filters = {
      keyword: keyword && String(keyword).trim() ? String(keyword).trim() : null,
      industry: industry || null,
      city: city && String(city).trim() ? String(city).trim() : null,
      employmentTypes: Array.isArray(employmentTypes)
        ? employmentTypes.filter(Boolean)
        : employmentTypes
        ? [employmentTypes]
        : [],
      isRemote:
        isRemote === true || isRemote === 'true'
          ? true
          : isRemote === false || isRemote === 'false'
          ? false
          : null,
    };

    const unsubscribeToken = generateUnsubscribeToken();
    const candidateId = req.candidateId || null;

    const sub = new JobAlertSubscriptionModel({
      email: normalizedEmail,
      filters,
      frequency: freq,
      status: 'active',
      candidate: candidateId,
      unsubscribeToken,
    });

    await sub.save();

    return res.json({
      success: true,
      message: "You're subscribed! We'll email you when new jobs match your preferences.",
      data: { subscribed: true },
    });
  } catch (err) {
    console.error('[jobAlert subscribe]', err?.message);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to subscribe',
    });
  }
}

/** GET /api/job-alert/unsubscribe?token=xxx - Unsubscribe by token */
export async function unsubscribe(req, res) {
  try {
    const token = req.query.token || req.body?.token;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Unsubscribe token is required',
      });
    }

    const result = await JobAlertSubscriptionModel.updateOne(
      { unsubscribeToken: token, status: 'active' },
      { $set: { status: 'unsubscribed', updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found or already unsubscribed',
      });
    }

    return res.json({
      success: true,
      message: "You've been unsubscribed from job alerts.",
    });
  } catch (err) {
    console.error('[jobAlert unsubscribe]', err?.message);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to unsubscribe',
    });
  }
}
