import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
// Dynamic imports for better code splitting - all views loaded on demand
import { useAuthStore } from '../stores/rbacStore';
import { useRbacStore } from '../stores/rbacStore';

// Extended route meta for RBAC support
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    public?: boolean;
    requiresPermission?: string | string[];  // RBAC permission check
    requiresAllPermissions?: boolean;  // If true, user must have ALL permissions
    title?: string;
    description?: string;
  }
}
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Landing',
    component: () => import('../views/landing/demo/DemoLandingPage.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/landing',
    name: 'LandingPage',
    component: () => import('../views/landing/demo/DemoLandingPage.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/technical',
    name: 'TechnicalLanding',
    component: () => import('../views/landing/demo/TextualLandingPage.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/app',
    component: () => import('../views/AgentsPage.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/app/welcome'
      },
      {
        path: 'home',
        name: 'Home',
        component: () => import('../views/HomePage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'welcome',
        name: 'Welcome',
        component: () => import('../views/WelcomePage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'chat',
        name: 'Chat', 
        component: () => import('../views/HomePage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'evaluations',
        name: 'Evaluations',
        component: () => import('../views/EvaluationsPage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'admin/evaluations',
        name: 'AdminEvaluations',
        component: () => import('../views/AdminEvaluationsPage.vue'),
        meta: { requiresAuth: true, requiresPermission: 'admin:audit' }
      },
      {
        path: 'admin/llm-usage',
        name: 'AdminLlmUsage',
        component: () => import('../views/admin/LlmUsageView.vue'),
        meta: { requiresAuth: true, requiresPermission: 'llm:admin' }
      },
      {
        path: 'deliverables',
        name: 'Deliverables',
        component: () => import('../views/DeliverablesListPage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'organization',
        name: 'Organization',
        component: () => import('../views/OrganizationPage.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'admin/pii-patterns',
        name: 'PIIManagement',
        component: () => import('../views/PIIManagementPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin:settings',
          title: 'PII Pattern Management',
          description: 'Manage PII detection patterns and rules'
        }
      },
      {
        path: 'admin/llm-usage/:runId',
        name: 'LLMUsageDetails',
        component: () => import('../views/admin/LLMUsageDetailsPage.vue'),
        meta: { requiresAuth: true, requiresPermission: 'llm:admin' }
      },
      {
        path: 'admin/approvals',
        name: 'AdminApprovals',
        component: () => import('../views/admin/AdminApprovalsView.vue'),
        meta: { requiresAuth: true, requiresPermission: 'admin:users' }
      },
      {
        path: 'admin/observability',
        name: 'AdminObservability',
        component: () => import('../views/admin/AdminObservabilityView.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin:audit',
          title: 'System Observability'
        }
      },
      {
        path: 'admin/database',
        name: 'AdminDatabase',
        component: () => import('../views/admin/DatabaseAdminPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin:settings',
          title: 'Database Administration',
          description: 'View database status, tables, and migrations'
        }
      },
      {
        path: 'admin/models',
        name: 'AdminModels',
        component: () => import('../views/admin/ProvidersModelsPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin:settings',
          title: 'Providers & Models',
          description: 'Manage LLM providers and models'
        }
      },
      {
        path: 'admin/agents',
        name: 'AdminAgents',
        component: () => import('../views/admin/AgentsAdminPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'agents:admin',
          title: 'Agents Administration',
          description: 'View and manage AI agents'
        }
      },
      {
        path: 'admin/mcp',
        name: 'AdminMCP',
        component: () => import('../views/admin/MCPAdminPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin:settings',
          title: 'MCP Servers & Tools',
          description: 'Manage MCP servers and available tools'
        }
      },
      {
        path: 'admin/organizations',
        name: 'AdminOrganizations',
        component: () => import('../views/admin/OrganizationsAdminPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin:settings',
          title: 'Organizations',
          description: 'Manage organizations'
        }
      },
      {
        path: 'admin/teams',
        name: 'AdminTeams',
        component: () => import('../views/admin/TeamsAdminPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin:users',
          title: 'Teams',
          description: 'Manage teams and team members'
        }
      },
      {
        path: 'admin/pii-testing',
        name: 'PIITesting',
        component: () => import('../views/PIITestingPage.vue'),
        meta: { requiresAuth: true, requiresPermission: 'admin:settings' }
      },
      {
        path: 'admin/pseudonym-dictionary',
        name: 'PseudonymDictionary',
        component: () => import('../views/PseudonymDictionaryPage.vue'),
        meta: { requiresAuth: true, requiresPermission: 'admin:settings' }
      },
      {
        path: 'admin/pseudonym-mappings',
        name: 'PseudonymMappings',
        component: () => import('../views/PseudonymMappingPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin:settings',
          title: 'Pseudonym Mapping Viewer',
          description: 'Visualize PII to pseudonym mappings and usage history'
        }
      },
      {
        path: 'admin/settings',
        name: 'AdminSettings',
        component: () => import('../views/AdminSettingsPage.vue'),
        meta: { requiresAuth: true, requiresPermission: 'admin:settings' }
      },
      {
        path: 'admin/users',
        name: 'AdminUsers',
        component: () => import('../views/admin/UserManagementPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin:users',
          title: 'User Management',
          description: 'Manage users and their roles'
        }
      },
      {
        path: 'admin/roles',
        name: 'AdminRoles',
        component: () => import('../views/admin/RoleManagementPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin:roles',
          title: 'Roles & Permissions',
          description: 'View and manage roles and permissions'
        }
      },
      {
        path: 'admin/rag/collections',
        name: 'RagCollections',
        component: () => import('../views/admin/RagCollectionsPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'rag:admin',
          title: 'RAG Collections',
          description: 'Manage knowledge base collections for RAG'
        }
      },
      {
        path: 'admin/rag/collections/:id',
        name: 'RagCollectionDetail',
        component: () => import('../views/admin/RagCollectionDetailPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'rag:admin',
          title: 'Collection Details',
          description: 'View and manage collection documents'
        }
      },
      // Marketing Swarm custom UI
      {
        path: 'agents/marketing-swarm',
        name: 'MarketingSwarm',
        component: () => import('../views/agents/marketing-swarm/MarketingSwarmPage.vue'),
        meta: {
          requiresAuth: true,
          title: 'Marketing Swarm',
          description: 'Multi-agent marketing content generation'
        }
      },
      {
        path: 'agents/:orgSlug/marketing-swarm',
        name: 'MarketingSwarmOrg',
        component: () => import('../views/agents/marketing-swarm/MarketingSwarmPage.vue'),
        meta: {
          requiresAuth: true,
          title: 'Marketing Swarm',
          description: 'Multi-agent marketing content generation'
        }
      },
      {
        path: 'agents/:orgSlug/marketing-swarm/tasks/:taskId',
        name: 'MarketingSwarmTask',
        component: () => import('../views/agents/marketing-swarm/MarketingSwarmPage.vue'),
        meta: {
          requiresAuth: true,
          title: 'Marketing Swarm Task',
          description: 'View marketing swarm task details'
        }
      },
      // Prediction Runner Dashboard Routes
      {
        path: 'prediction/dashboard',
        name: 'PredictionDashboard',
        component: () => import('../views/prediction/PredictionDashboard.vue'),
        meta: {
          requiresAuth: true,
          title: 'Prediction Dashboard',
          description: 'View and manage predictions'
        }
      },
      {
        path: 'prediction/test-lab',
        name: 'TestLab',
        component: () => import('../views/prediction/TestLabView.vue'),
        meta: {
          requiresAuth: true,
          title: 'Test Lab',
          description: 'Build and manage test scenarios for the prediction system'
        }
      },
      {
        path: 'prediction/portfolios',
        name: 'PortfolioManagement',
        component: () => import('../views/prediction/UniverseManagement.vue'),
        meta: {
          requiresAuth: true,
          title: 'Portfolio Management',
          description: 'Manage prediction portfolios and targets'
        }
      },
      {
        path: 'prediction/portfolio/:id',
        name: 'PortfolioDetail',
        component: () => import('../views/prediction/PortfolioDetail.vue'),
        meta: {
          requiresAuth: true,
          title: 'Portfolio Detail',
          description: 'View and manage portfolio instruments'
        }
      },
      {
        path: 'prediction/review-queue',
        name: 'ReviewQueue',
        component: () => import('../views/prediction/ReviewQueue.vue'),
        meta: {
          requiresAuth: true,
          title: 'Review Queue',
          description: 'Review and approve predictions'
        }
      },
      {
        path: 'prediction/learning-queue',
        name: 'LearningQueue',
        component: () => import('../views/prediction/LearningQueue.vue'),
        meta: {
          requiresAuth: true,
          title: 'Learning Queue',
          description: 'Review and approve learnings'
        }
      },
      {
        path: 'prediction/learnings',
        name: 'LearningsManagement',
        component: () => import('../views/prediction/LearningsManagement.vue'),
        meta: {
          requiresAuth: true,
          title: 'Learnings Management',
          description: 'Manage system learnings'
        }
      },
      {
        path: 'prediction/analysts',
        name: 'AnalystManagement',
        component: () => import('../views/prediction/AnalystManagement.vue'),
        meta: {
          requiresAuth: true,
          title: 'Analyst Management',
          description: 'Manage prediction analysts'
        }
      },
      {
        path: 'prediction/tool-wishlist',
        name: 'ToolWishlist',
        component: () => import('../views/prediction/ToolWishlist.vue'),
        meta: {
          requiresAuth: true,
          title: 'Tool Wishlist',
          description: 'View requested tools and capabilities'
        }
      },
      {
        path: 'prediction/missed-opportunities',
        name: 'MissedOpportunities',
        component: () => import('../views/prediction/MissedOpportunities.vue'),
        meta: {
          requiresAuth: true,
          title: 'Missed Opportunities',
          description: 'Analyze missed prediction opportunities'
        }
      },
      {
        path: 'prediction/alerts',
        name: 'PredictionAlerts',
        component: () => import('../views/prediction/AlertsView.vue'),
        meta: {
          requiresAuth: true,
          title: 'Prediction Alerts',
          description: 'View active alerts and alert history'
        }
      },
      {
        path: 'prediction/crawl-status',
        name: 'SourceCrawlStatus',
        component: () => import('../views/prediction/SourceCrawlStatus.vue'),
        meta: {
          requiresAuth: true,
          title: 'Source Crawl Status',
          description: 'Monitor source crawl status and errors'
        }
      },
      {
        path: 'prediction/:id',
        name: 'PredictionDetail',
        component: () => import('../views/prediction/PredictionDetail.vue'),
        meta: {
          requiresAuth: true,
          title: 'Prediction Detail',
          description: 'View prediction details'
        }
      },
      {
        path: 'prediction/target/:id',
        name: 'TargetDetail',
        component: () => import('../views/prediction/TargetDetail.vue'),
        meta: {
          requiresAuth: true,
          title: 'Target Detail',
          description: 'View target details and predictions'
        }
      },
      // Phase 3: Test Data Management UI Routes
      {
        path: 'test',
        name: 'TestControlCenter',
        component: () => import('../views/test/TestControlCenter.vue'),
        meta: {
          requiresAuth: true,
          title: 'Test Control Center',
          description: 'Main hub for test data management'
        }
      },
      {
        path: 'test/targets',
        name: 'TargetMirrors',
        component: () => import('../views/test/TargetMirrorsView.vue'),
        meta: {
          requiresAuth: true,
          title: 'Targets & Mirrors',
          description: 'Map production targets to test symbols'
        }
      },
      {
        path: 'test/articles',
        name: 'TestArticles',
        component: () => import('../views/test/TestArticlesView.vue'),
        meta: {
          requiresAuth: true,
          title: 'Synthetic Articles',
          description: 'Manage synthetic test articles'
        }
      },
      {
        path: 'test/prices',
        name: 'TestPrices',
        component: () => import('../views/test/TestPriceTimelineView.vue'),
        meta: {
          requiresAuth: true,
          title: 'Price Timeline',
          description: 'Manage test price data'
        }
      },
      {
        path: 'test/scenarios/new',
        name: 'ScenarioBuilder',
        component: () => import('../views/test/ScenarioBuilderView.vue'),
        meta: {
          requiresAuth: true,
          title: 'Scenario Builder',
          description: 'Create new test scenarios'
        }
      },
      {
        path: 'test/learnings/promotion',
        name: 'LearningPromotion',
        component: () => import('../views/prediction/test/LearningPromotionView.vue'),
        meta: {
          requiresAuth: true,
          title: 'Learning Promotion Queue',
          description: 'Review and promote test learnings to production'
        }
      },
      {
        path: 'test/backtests',
        name: 'Backtests',
        component: () => import('../views/prediction/test/BacktestView.vue'),
        meta: {
          requiresAuth: true,
          title: 'Backtests',
          description: 'Run and review backtests for test learnings'
        }
      },
      {
        path: 'test/analytics',
        name: 'TestAnalytics',
        component: () => import('../views/prediction/test/AnalyticsDashboardView.vue'),
        meta: {
          requiresAuth: true,
          title: 'Test Analytics',
          description: 'Test vs production analytics for the learning loop'
        }
      },
      // Risk Dashboard Routes
      {
        path: 'risk/dashboard',
        name: 'RiskDashboard',
        component: () => import('../views/risk/RiskDashboard.vue'),
        meta: {
          requiresAuth: true,
          title: 'Risk Dashboard',
          description: 'Investment risk analysis dashboard'
        }
      }
    ]
  },
  {
    path: '/videos',
    name: 'VideoGallery',
    component: () => import('../views/VideoGalleryPage.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/login', 
    name: 'Login',
    component: () => import('../views/LoginPage.vue')
  },
  {
    path: '/access-denied',
    name: 'AccessDenied',
    component: () => import('../views/AccessDeniedPage.vue'),
    meta: { requiresAuth: true }
  }
];
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});
// Navigation guard for authentication, roles, and permissions
router.beforeEach(async (to, from, next) => {
  // Check if route requires auth
  if (to.matched.some(record => record.meta.requiresAuth)) {
    const authStore = useAuthStore();
    const rbacStore = useRbacStore();

    // Check if user is authenticated
    if (!authStore.isAuthenticated) {
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      });
      return;
    }

    // Initialize RBAC store if needed
    if (!rbacStore.isInitialized) {
      try {
        await rbacStore.initialize();
      } catch (error) {
        console.error('Failed to initialize RBAC:', error);
      }
    }

    // Check if route requires specific RBAC permissions (new system)
    const requiredPermissions = to.meta.requiresPermission;
    if (requiredPermissions) {
      const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      const requireAll = to.meta.requiresAllPermissions === true;

      const hasAccess = requireAll
        ? rbacStore.hasAllPermissions(permissions)
        : rbacStore.hasAnyPermission(permissions);

      if (!hasAccess) {
        next({
          path: '/access-denied',
          query: {
            requiredPermission: permissions.join(','),
            attemptedPath: to.fullPath
          }
        });
        return;
      }
    }

    // If navigating to /app or /app/welcome and user is admin, redirect to admin dashboard
    if ((to.path === '/app' || to.path === '/app/welcome' || to.name === 'Welcome') && authStore.isAdmin) {
      // Only redirect if not explicitly coming from admin area
      if (!from.path.startsWith('/app/admin')) {
        next({ path: '/app/admin/settings' });
        return;
      }
    }

    // If navigating to /app/home and user is admin, prefer the admin dashboard
    // UNLESS there's a specific query parameter or redirect indicating intent to go to home
    if ((to.name === 'Home' || to.path === '/app/home') && authStore.isAdmin) {
      // Check if there's an active conversation or if coming from agent selection
      const hasActiveConversation = from?.path?.includes('/app/home') ||
                                   to.query?.conversationId ||
                                   to.query?.agentId ||
                                   to.query.forceHome ||
                                   sessionStorage.getItem('activeConversation');

      if (!hasActiveConversation && from.path !== '/app') {
        next({ path: '/app/admin/settings' });
        return;
      }
    }
    next();
  } else {
    next();
  }
});
export default router;
