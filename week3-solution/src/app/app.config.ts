import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { provideMarkdown } from 'ngx-markdown';

// Firebase is initialized once in src/app/firebase.ts (raw modular SDK),
// so no Firebase providers are needed here. Services import { firestore,
// firebaseAuth } from '../firebase' directly.

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideMarkdown()
  ]
};
