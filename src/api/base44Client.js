import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Local dev safety layer: if appId is missing or null, provide mock local implementation
const hasBase44App = Boolean(appId && appId !== 'null' && appBaseUrl && appBaseUrl !== 'null');

const realClient = hasBase44App
  ? createClient({
      appId,
      token,
      functionsVersion,
      serverUrl: appBaseUrl,
      requiresAuth: false,
      appBaseUrl,
    })
  : null;

// Local Storage Fallback for SavedPlot entity when running locally without Base44 cloud
const mockEntities = {
  SavedPlot: {
    list: async () => {
      try {
        const raw = localStorage.getItem('plotscale_saved_plots');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
    create: async (data) => {
      try {
        const raw = localStorage.getItem('plotscale_saved_plots');
        const list = raw ? JSON.parse(raw) : [];
        const record = { ...data, id: data.id || `plot_${Date.now()}`, created_at: new Date().toISOString() };
        list.push(record);
        localStorage.setItem('plotscale_saved_plots', JSON.stringify(list));
        return record;
      } catch {
        return { ...data, id: `plot_${Date.now()}` };
      }
    },
    update: async (id, data) => {
      try {
        const raw = localStorage.getItem('plotscale_saved_plots');
        let list = raw ? JSON.parse(raw) : [];
        let record = { ...data, id, updated_at: new Date().toISOString() };
        list = list.map(item => item.id === id ? { ...item, ...record } : item);
        localStorage.setItem('plotscale_saved_plots', JSON.stringify(list));
        return record;
      } catch {
        return { ...data, id };
      }
    },
    delete: async (id) => {
      try {
        const raw = localStorage.getItem('plotscale_saved_plots');
        let list = raw ? JSON.parse(raw) : [];
        list = list.filter(item => item.id !== id);
        localStorage.setItem('plotscale_saved_plots', JSON.stringify(list));
        return true;
      } catch {
        return false;
      }
    }
  }
};

const mockAuth = {
  isAuthenticated: async () => true,
  me: async () => ({ id: 'local_user', email: 'user@local' }),
  redirectToLogin: () => {},
  logout: () => {},
};

export const base44 = hasBase44App
  ? realClient
  : {
      auth: mockAuth,
      entities: mockEntities,
    };
