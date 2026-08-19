/**
 * Facebook Pixel event helper.
 * Only fires on carreiraid.com.br to avoid polluting analytics.
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

export function isProduction(): boolean {
  const h = window.location.hostname;
  return h === 'carreiraid.com.br' || h === 'www.carreiraid.com.br';
}

export function trackFbEvent(eventName: string, params?: Record<string, any>) {
  if (!isProduction() || !window.fbq) return;
  window.fbq('track', eventName, params);
}

// ---- Convenience wrappers ----

/** User completed signup (email or Google) */
export function trackCompleteRegistration(method: 'email' | 'google') {
  trackFbEvent('CompleteRegistration', { content_name: 'carreira_id', method });
}

/** User created their profile */
export function trackProfileCreated(profileType: string) {
  trackFbEvent('Lead', { content_name: 'profile_created', content_category: profileType });
}

/** User clicked to subscribe to a plan */
export function trackInitiateCheckout(plan: string, value?: number) {
  trackFbEvent('InitiateCheckout', { content_name: plan, value, currency: 'BRL' });
}

/** Subscription payment confirmed */
export function trackSubscribe(plan: string, value?: number) {
  trackFbEvent('Subscribe', { content_name: plan, value, currency: 'BRL' });
}

/** Generic custom event via dataLayer (GTM) */
export function pushDataLayer(event: string, params?: Record<string, any>) {
  if (!isProduction()) return;
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push({ event, ...params });
}
