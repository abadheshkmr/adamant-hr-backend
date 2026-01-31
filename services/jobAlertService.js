import sgMail from '@sendgrid/mail';
import JobAlertSubscriptionModel from '../models/jobAlertSubscriptionModel.js';
import vacancyModel from '../models/vacancyModel.js';

const PORTAL_BASE = process.env.CANDIDATE_PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:5173';

function isSendGridConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_MAIL_FROM);
}

/** Check if a vacancy matches a subscription's filters */
function vacancyMatchesSubscription(vacancy, sub) {
  const f = sub.filters || {};
  const v = vacancy;

  if (f.keyword && f.keyword.trim()) {
    const kw = f.keyword.trim().toLowerCase();
    const searchable = [
      v.jobTitle || '',
      v.description || '',
      (v.skills || []).join(' '),
    ]
      .join(' ')
      .toLowerCase();
    if (!searchable.includes(kw)) return false;
  }

  if (f.industry && v.industry) {
    const subInd = f.industry.toString ? f.industry.toString() : f.industry;
    const vacInd = v.industry._id ? v.industry._id.toString() : v.industry.toString();
    if (subInd !== vacInd) return false;
  }

  if (f.city && f.city.trim()) {
    const cityMatch = (v.location?.city || '').toLowerCase().includes(f.city.trim().toLowerCase());
    if (!cityMatch) return false;
  }

  if (f.employmentTypes && f.employmentTypes.length > 0) {
    if (!f.employmentTypes.includes(v.employmentType)) return false;
  }

  if (f.isRemote !== null && f.isRemote !== undefined) {
    const isRemote = v.location?.isRemote ?? false;
    if (isRemote !== f.isRemote) return false;
  }

  return true;
}

/** Build MongoDB filter for vacancies from subscription */
function buildVacancyFilter(subscription) {
  const f = subscription.filters || {};
  const filter = { status: 'active' };

  if (f.keyword && f.keyword.trim()) {
    const searchRegex = new RegExp(f.keyword.trim(), 'i');
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { jobTitle: searchRegex },
        { description: searchRegex },
        { skills: searchRegex },
      ],
    });
  }

  if (f.industry) {
    filter.industry = f.industry;
  }

  if (f.city && f.city.trim()) {
    filter['location.city'] = new RegExp(f.city.trim(), 'i');
  }

  if (f.employmentTypes && f.employmentTypes.length > 0) {
    filter.employmentType = { $in: f.employmentTypes };
  }

  if (f.isRemote !== null && f.isRemote !== undefined) {
    filter['location.isRemote'] = f.isRemote;
  }

  return filter;
}

/** Send job alert email to a subscriber */
async function sendJobAlertEmail(subscription, vacancies) {
  if (!isSendGridConfigured()) {
    console.warn('[jobAlertService] SendGrid not configured, skipping email');
    return;
  }

  const from = process.env.SENDGRID_MAIL_FROM;
  const careersUrl = `${PORTAL_BASE}/#/careers`;
  const unsubscribeUrl = `${PORTAL_BASE}/#/unsubscribe?token=${subscription.unsubscribeToken}`;

  const jobListHtml = vacancies
    .slice(0, 10)
    .map(
      (v) => `
    <li style="margin-bottom: 12px;">
      <a href="${careersUrl}/${v.jobId}" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">${v.jobTitle}</a>
      ${v.employmentType ? `<span style="color: #64748b; font-size: 12px;"> • ${v.employmentType}</span>` : ''}
    </li>
  `
    )
    .join('');

  const moreCount = vacancies.length > 10 ? vacancies.length - 10 : 0;

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">New jobs matching your alert</h2>
      <p>We found <strong>${vacancies.length}</strong> new ${vacancies.length === 1 ? 'role' : 'roles'} that match your preferences.</p>
      <ul style="list-style: none; padding: 0;">
        ${jobListHtml}
      </ul>
      ${moreCount > 0 ? `<p style="color: #64748b;">...and ${moreCount} more. <a href="${careersUrl}">View all</a></p>` : ''}
      <p><a href="${careersUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px;">Browse all jobs</a></p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
        <a href="${unsubscribeUrl}" style="color: #94a3b8;">Unsubscribe from job alerts</a>
      </p>
    </div>
  `;

  const text = `New jobs matching your alert:\n\n${vacancies
    .slice(0, 10)
    .map((v) => `- ${v.jobTitle} (${v.jobId})`)
    .join('\n')}\n\nView all: ${careersUrl}\n\nUnsubscribe: ${unsubscribeUrl}`;

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  await sgMail.send({
    to: subscription.email,
    from,
    subject: `You have ${vacancies.length} new job ${vacancies.length === 1 ? 'match' : 'matches'} | Adamant HR`,
    text,
    html,
  });
}

/** Process instant alerts when a new vacancy is created */
export async function processInstantAlerts(vacancy) {
  if (!vacancy || vacancy.status !== 'active') return;

  try {
    const subs = await JobAlertSubscriptionModel.find({
      status: 'active',
      frequency: 'instant',
    }).lean();

    const populated = await vacancyModel
      .findById(vacancy._id)
      .populate('industry', 'name')
      .lean();

    const matching = subs.filter((s) => vacancyMatchesSubscription(populated, s));
    for (const sub of matching) {
      try {
        await sendJobAlertEmail(sub, [populated]);
        await JobAlertSubscriptionModel.updateOne(
          { _id: sub._id },
          { $set: { lastSentAt: new Date() } }
        );
      } catch (err) {
        console.error(`[jobAlertService] Failed to send instant alert to ${sub.email}:`, err?.message);
      }
    }
  } catch (err) {
    console.error('[jobAlertService] processInstantAlerts error:', err?.message);
  }
}

/** Process scheduled alerts (daily/weekly) - called by cron */
export async function processScheduledAlerts() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const dailySubs = await JobAlertSubscriptionModel.find({
      status: 'active',
      frequency: 'daily',
      $or: [{ lastSentAt: null }, { lastSentAt: { $lte: oneDayAgo } }],
    }).lean();

    const weeklySubs = await JobAlertSubscriptionModel.find({
      status: 'active',
      frequency: 'weekly',
      $or: [{ lastSentAt: null }, { lastSentAt: { $lte: oneWeekAgo } }],
    }).lean();

    const toProcess = [...dailySubs, ...weeklySubs];

    for (const sub of toProcess) {
      try {
        const since = sub.lastSentAt || new Date(0);
        const filter = buildVacancyFilter(sub);
        filter.createdAt = { $gt: since };

        const vacancies = await vacancyModel
          .find(filter)
          .populate('industry', 'name')
          .select('jobTitle jobId employmentType location industry')
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();

        if (vacancies.length === 0) continue;

        await sendJobAlertEmail(sub, vacancies);
        await JobAlertSubscriptionModel.updateOne(
          { _id: sub._id },
          { $set: { lastSentAt: now } }
        );
      } catch (err) {
        console.error(`[jobAlertService] Failed scheduled alert to ${sub.email}:`, err?.message);
      }
    }
  } catch (err) {
    console.error('[jobAlertService] processScheduledAlerts error:', err?.message);
  }
}
