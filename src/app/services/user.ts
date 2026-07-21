import { Injectable } from "@angular/core";
import { User } from "../models/user.model";

@Injectable({ providedIn: 'root' })
export class UserService {
  private cv: string | undefined;

  updateUser(newUser: User): Promise<void> {
    this.cv = newUser.cv;
    return Promise.resolve();
  }

  getUser(): Promise<User | undefined> {
    return new Promise(resolve => setTimeout(() => resolve({
      cv: this.cv,
      email: 'test.test.com'
    }), 3000));
  }
}
