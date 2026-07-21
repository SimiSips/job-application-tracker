import { inject, Component, ChangeDetectorRef } from "@angular/core";
import { AuthService } from "../../services/auth";
import { Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";

@Component({
    selector: 'app-login',
    imports: [FormsModule, RouterLink],
    templateUrl: './login.component.html'
})
export class Login {
    private authService = inject(AuthService);
    private router = inject(Router);
    private changeDetector = inject(ChangeDetectorRef);

    email = '';
    password = '';

    errorMessage = '';
    isSubmitting = false;

    async onSubmit() {
        this.errorMessage = '';
        this.isSubmitting = true;

        try {
            console.log(this.email, this.password)
            await this.authService.signIn(this.email, this.password);
            this.router.navigate(['/dashboard']);
        } catch(err) {
            this.errorMessage = 'Invalid email or password. Try again.';
            this.changeDetector.markForCheck();
        } finally {
            this.isSubmitting = false;
        }
    }
}