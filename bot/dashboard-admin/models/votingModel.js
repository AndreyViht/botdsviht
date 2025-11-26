// Voting model — управление голосованиями
const db = require('../../libs/db');

const VOTING_DURATION_MS = 10 * 60 * 1000; // 10 minutes

async function startPresidentVoting(guild, initiatorId, candidates) {
  try {
    const votingData = {
      type: 'president',
      startedAt: Date.now(),
      endsAt: Date.now() + VOTING_DURATION_MS,
      initiatorId,
      candidates: candidates || [], // Store candidates array
      votes: {}, // { userId: candidateId }
      active: true
    };
    if (db && db.set) await db.set('voting', votingData);
    console.log('[Voting] President voting started with', candidates?.length || 0, 'candidates');
    return votingData;
  } catch (e) {
    console.error('startPresidentVoting error:', e.message);
    return null;
  }
}

function getActiveVoting() {
  const voting = db.get('voting');
  if (!voting || !voting.active) return null;
  if (Date.now() >= voting.endsAt) return null; // Expired
  return voting;
}

async function endVoting() {
  try {
    const voting = db.get('voting');
    if (!voting) return null;
    voting.active = false;
    voting.endedAt = Date.now();
    if (db && db.set) await db.set('voting', voting);
    console.log('[Voting] Voting ended');
    return voting;
  } catch (e) {
    console.error('endVoting error:', e.message);
    return null;
  }
}

function isVotingExpired() {
  const voting = db.get('voting');
  if (!voting || !voting.active) return true;
  return Date.now() >= voting.endsAt;
}

function getVotingRemainingSeconds() {
  const voting = db.get('voting');
  if (!voting || !voting.active) return 0;
  const remaining = voting.endsAt - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
}

async function recordVote(userId, candidateId) {
  try {
    const voting = db.get('voting');
    if (!voting) return false;
    if (!voting.votes) voting.votes = {};
    voting.votes[userId] = candidateId;
    if (db && db.set) await db.set('voting', voting);
    return true;
  } catch (e) {
    console.error('recordVote error:', e.message);
    return false;
  }
}

async function getVotingResults() {
  try {
    const voting = db.get('voting');
    if (!voting) return null;
    
    const results = {};
    for (const [voterId, candidateId] of Object.entries(voting.votes || {})) {
      if (!results[candidateId]) results[candidateId] = 0;
      results[candidateId]++;
    }
    
    return {
      candidates: voting.candidates || [],
      votes: voting.votes || {},
      results,
      totalVotes: Object.keys(voting.votes || {}).length
    };
  } catch (e) {
    console.error('getVotingResults error:', e.message);
    return null;
  }
}

module.exports = {
  startPresidentVoting,
  getActiveVoting,
  endVoting,
  isVotingExpired,
  getVotingRemainingSeconds,
  recordVote,
  getVotingResults,
  VOTING_DURATION_MS
};
