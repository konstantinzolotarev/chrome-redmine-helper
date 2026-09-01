import { mount } from 'svelte';
import '@/assets/tailwind.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app mount point');

export default mount(App, { target });
