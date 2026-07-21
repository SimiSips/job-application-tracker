import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth";
import { map, take } from "rxjs";

export const guestGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.currentUser$.pipe(
        take(1),
        map((user) => (user ? router.createUrlTree(['/dashboard']) : true))
    )
}
