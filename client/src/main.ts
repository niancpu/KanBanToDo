import { createApp } from 'vue';
import { createPinia } from 'pinia';
import vuetify from './plugins/vuetify';
import App from './App.vue';
import router from './router';
import './assets/main.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(vuetify);

// 刷新页面后恢复同步连接
import { useAuthStore } from '@/stores/auth';
const authStore = useAuthStore();
authStore.restoreSession();

app.mount('#app');
