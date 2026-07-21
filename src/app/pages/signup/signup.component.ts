import { ChangeDetectorRef, Component, inject } from "@angular/core";
import { AuthService } from "../../services/auth";
import { Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";

@Component({
    selector: 'app-signup',
    imports: [FormsModule, RouterLink],
    templateUrl: './signup.component.html'
})
export class SignUp {
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
            await this.authService.signUp(this.email, this.password);
            this.router.navigate(['/dashboard']);
        } catch(err) {
            this.errorMessage = 'Could not create an account. That email may already be in use.';
            this.changeDetector.markForCheck();
        } finally {
            this.isSubmitting = false;
        }
    }}