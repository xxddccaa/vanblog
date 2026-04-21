const fastgptDb = db.getSiblingDB('fastgpt');

const freeLevel = 'free';
const freeMode = 'month';
const totalPoints = Number(process.env.FASTGPT_FREE_PLAN_POINTS || 100);
const durationDays = Number(process.env.FASTGPT_FREE_PLAN_DURATION_DAYS || 30);

const now = new Date();
const expiredTime = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

let inserted = 0;
let repaired = 0;

const teams = fastgptDb.teams.find({}, { _id: 1 }).toArray();

teams.forEach((team) => {
  const existing = fastgptDb.team_subscriptions.findOne({
    teamId: team._id,
    type: 'standard',
  });

  if (!existing) {
    fastgptDb.team_subscriptions.insertOne({
      teamId: team._id,
      type: 'standard',
      currentMode: freeMode,
      nextMode: freeMode,
      startTime: now,
      expiredTime,
      currentSubLevel: freeLevel,
      nextSubLevel: freeLevel,
      totalPoints,
      surplusPoints: totalPoints,
    });
    inserted += 1;
    return;
  }

  const patch = {};
  if (!existing.currentMode) patch.currentMode = freeMode;
  if (!existing.nextMode) patch.nextMode = patch.currentMode || existing.currentMode || freeMode;
  if (!existing.currentSubLevel) patch.currentSubLevel = freeLevel;
  if (!existing.nextSubLevel) {
    patch.nextSubLevel = patch.currentSubLevel || existing.currentSubLevel || freeLevel;
  }
  if (!existing.startTime) patch.startTime = now;
  if (!existing.expiredTime) patch.expiredTime = expiredTime;
  if (typeof existing.totalPoints !== 'number') patch.totalPoints = totalPoints;
  if (typeof existing.surplusPoints !== 'number') patch.surplusPoints = totalPoints;

  if (Object.keys(patch).length > 0) {
    fastgptDb.team_subscriptions.updateOne({ _id: existing._id }, { $set: patch });
    repaired += 1;
  }
});

printjson({
  teams: teams.length,
  inserted,
  repaired,
  totalPoints,
  durationDays,
});
