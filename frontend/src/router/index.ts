import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/config', // New Route
      name: 'config',
      // Lazy-load the component for better performance
      component: () => import('../views/ConfigView.vue')
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../views/HistoryView.vue')
    },
    {
      path: '/results/:id', // Dynamic route with an ID parameter
      name: 'results',
      component: () => import('../views/ResultsView.vue')
    },
    {
      path: '/filtered-data',
      name: 'filtered-data',
      component: () => import('../views/FilteredDataView.vue')
    },
     {
      path: '/archive',
      name: 'archive',
      component: () => import('../views/ArchivedStrategiesView.vue')
    },
     {
      path: '/data',
      name: 'data',
      component: () => import('../views/DataView.vue')
    },
  ]
})

export default router