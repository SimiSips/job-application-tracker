import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then(m => m.Home)},
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.Login), canActivate: [guestGuard] },
  { path: 'signup', loadComponent: () => import('./pages/signup/signup.component').then(m => m.SignUp), canActivate: [guestGuard] },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard), canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
