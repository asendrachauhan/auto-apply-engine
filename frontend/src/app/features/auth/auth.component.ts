import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Shell for all unauthenticated routes (/auth/login, /auth/register,
 * /auth/forgot-password). Just hosts the router outlet — each child owns
 * its own full-page layout so they can be reached directly by deep link too.
 */
@Component({
  selector: 'aa-auth',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AuthComponent {}
