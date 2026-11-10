import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import LayoutView from '../views/LayoutView.vue'
import UploadView from '../views/UploadView.vue'
import ClientView from '../views/ClientView.vue'
import DashboardView from '../views/DashboardView.vue'
import DeviceManageView from '../views/DeviceManageView.vue'
import UserManageView from '../views/UserManageView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
    },
    {
      path: '/admin',
      component: LayoutView,
      meta: { requiresAuth: true, role: 'admin' },
      children: [
        {
          path: '',
          redirect: '/admin/overview',
        },
        {
          path: 'overview',
          name: 'admin-overview',
          component: DashboardView,
        },
        {
          path: 'upload',
          name: 'admin-upload',
          component: UploadView,
        },
        {
          path: 'users',
          name: 'admin-users',
          component: UserManageView,
        },
        {
          path: 'devices',
          name: 'admin-devices',
          component: DeviceManageView,
        },
      ],
    },
    {
      path: '/client',
      component: LayoutView,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/client/phones',
        },
        {
          path: 'phones',
          name: 'client-phones',
          component: ClientView,
        },
        {
          path: 'upload',
          name: 'client-upload',
          component: UploadView,
        },
      ],
    },
    {
      path: '/',
      redirect: '/login',
    },
  ],
})

router.beforeEach((to, from) => {
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')

  if (to.matched.some((r) => r.meta.requiresAuth) && !token) {
    return { name: 'login' }
  }

  if (to.name === 'login' && token) {
    if (role === 'admin') return { name: 'admin-overview' }
    return { name: 'client-phones' }
  }

  if (to.name === 'register' && token) {
    if (role === 'admin') return { name: 'admin-overview' }
    return { name: 'client-phones' }
  }

  if (to.meta.role === 'admin' && role !== 'admin') {
    return { name: 'client-phones' }
  }
})

export default router
