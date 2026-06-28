/**
 * Plan catalogue
 * Only starter / pro / enterprise are available for onboarding.
 * 'free' is reserved for internal / legacy use only.
 */

const PLANS = {
  starter: {
    name: 'starter',
    maxUsers: 20,
    maxAgents: 5,
    maxTickets: 500,
    maxDepartments: 3,
    maxTeams: 5,
    features: {
      customDomain: false,
      slaManagement: false,
      advancedReporting: false,
      apiAccess: false,
      prioritySupport: false,
    },
  },
  pro: {
    name: 'pro',
    maxUsers: 100,
    maxAgents: 25,
    maxTickets: 5000,
    maxDepartments: 10,
    maxTeams: 20,
    features: {
      customDomain: true,
      slaManagement: true,
      advancedReporting: true,
      apiAccess: false,
      prioritySupport: false,
    },
  },
  enterprise: {
    name: 'enterprise',
    maxUsers: 99999,
    maxAgents: 99999,
    maxTickets: 99999,
    maxDepartments: 99999,
    maxTeams: 99999,
    features: {
      customDomain: true,
      slaManagement: true,
      advancedReporting: true,
      apiAccess: true,
      prioritySupport: true,
    },
  },
};

const ONBOARDING_PLAN_IDS = Object.keys(PLANS); // ['starter', 'pro', 'enterprise']

module.exports = { PLANS, ONBOARDING_PLAN_IDS };
