import { Auth, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { Observable, shareReplay } from "rxjs";
import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth: Auth = firebaseAuth;

    currentUser$ = new Observable<User | null>((subscriber => {
        return onAuthStateChanged(this.auth, subscriber);
    })).pipe(shareReplay(1));

    signUp(email: string, password: string) {
        return createUserWithEmailAndPassword(this.auth, email, password);
    }

    signIn(email: string, password: string) {
        return signInWithEmailAndPassword(this.auth, email, password);
    }

    logOut() {
        return signOut(this.auth);
    }
}
