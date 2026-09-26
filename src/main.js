import { createProductionRuntime } from './app/production-runtime.js';
import { registerFeatures } from './app/register-features.js?v=2026-09-26-v01';
import { initializeApp } from './app/initialize.js?v=2026-09-26-v01';
import { setup as setup1 } from './ui/enhancement-1.js';
import { setup as setup2 } from './ui/enhancement-2.js';
import { setup as setup3 } from './ui/enhancement-3.js';

try{
  const runtime=createProductionRuntime();
  const appContext={
    localStorage:runtime.localStorage,
    sessionStorage:runtime.sessionStorage,
    fetch:runtime.fetch
  };
  registerFeatures(appContext);
  initializeApp(appContext,runtime);
  setup1(appContext);
  setup2(appContext);
  setup3(appContext);
}catch(error){
  console.error('Collect TCG startup failed:',error);
  const notice=document.createElement('p');
  notice.setAttribute('role','alert');
  notice.textContent='Collect TCG could not start: '+error.message;
  document.body.prepend(notice);
}
