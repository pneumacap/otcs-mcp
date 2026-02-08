import type { OTCSAuthResponse } from '../types';
import { OTCSClient } from './base';

declare module './base.js' {
  interface OTCSClient {
    authenticate(username?: string, password?: string, domain?: string): Promise<string>;
    validateSession(): Promise<boolean>;
    logout(): Promise<void>;
  }
}

OTCSClient.prototype.authenticate = async function (
  this: OTCSClient,
  username?: string,
  password?: string,
  domain?: string,
): Promise<string> {
  const user = username || this.config.username;
  const pass = password || this.config.password;
  const dom = domain || this.config.domain;

  if (!user || !pass) {
    throw new Error('Username and password are required for authentication');
  }

  const formData = new URLSearchParams();
  formData.append('username', user);
  formData.append('password', pass);
  if (dom) {
    formData.append('domain', dom);
  }

  const response = await fetch(`${this.baseUrl}/v1/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
    ...this.fetchOptions(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Authentication failed: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as OTCSAuthResponse;
  this.ticket = data.ticket;
  return this.ticket;
};

OTCSClient.prototype.validateSession = async function (this: OTCSClient): Promise<boolean> {
  if (!this.ticket) return false;

  try {
    const response = await fetch(`${this.baseUrl}/v2/auth`, {
      method: 'HEAD',
      headers: this.getHeaders(),
      ...this.fetchOptions(),
    });
    return response.ok;
  } catch {
    return false;
  }
};

OTCSClient.prototype.logout = async function (this: OTCSClient): Promise<void> {
  if (!this.ticket) return;

  await fetch(`${this.baseUrl}/v2/auth`, {
    method: 'DELETE',
    headers: this.getHeaders(),
    ...this.fetchOptions(),
  });
  this.ticket = null;
};
