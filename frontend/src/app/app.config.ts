import { ApplicationConfig, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { routes }              from './app.routes';
import { authInterceptor }     from './core/interceptors/auth.interceptor';
import { loadingInterceptor }  from './core/interceptors/loading.interceptor';
import { AuthService }         from './core/services/auth.service';
import { LanguageService }     from './core/services/language.service';

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, '/assets/i18n/', '.json');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withInterceptors([authInterceptor, loadingInterceptor])),
    provideAnimations(),
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'en',
        loader: {
          provide : TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps    : [HttpClient],
        },
      })
    ),
    {
      // Resolve the persisted session BEFORE the router runs any guards, so
      // a page reload never races currentUser() against fetchMe().
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthService) => () => auth.init(),
      deps: [AuthService],
      multi: true,
    },
    {
      // Apply the saved/detected language before any route (including the
      // auth pages) renders, so login/register/etc. are translated too.
      provide: APP_INITIALIZER,
      useFactory: (lang: LanguageService) => () => lang.init(),
      deps: [LanguageService],
      multi: true,
    },
  ],
};
