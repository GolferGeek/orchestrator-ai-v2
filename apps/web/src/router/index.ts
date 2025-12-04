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
    path: '/my-org',
    name: 'MyOrgLanding',
    component: () => import('../views/landing/my-org/MyOrgLandingPage.vue'),
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/saas',
    name: 'SaasLanding',
    component: () => import('../views/landing/saas/SaasLandingPage.vue'),
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
        path: 'admin/data-sanitization',
        name: 'DataSanitization',
        component: () => import('../views/admin/DataSanitizationPage.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin:settings',
          title: 'Data Sanitization Dashboard',
          description: 'Manage PII detection, pseudonymization, and data protection policies'
        }
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
        path: 'admin/system-health',
        name: 'AdminSystemHealth',
        component: () => import('../views/admin/SystemHealthView.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin:audit',
          title: 'System Health'
        }
      },
      {
        path: 'admin/function-agents',
        name: 'AdminFunctionAgents',
        component: () => import('../views/admin/AdminFunctionAgentsView.vue'),
        meta: { requiresAuth: true, requiresPermission: 'agents:admin' }
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
