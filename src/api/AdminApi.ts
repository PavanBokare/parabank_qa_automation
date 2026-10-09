import { APIRequestContext, expect } from '@playwright/test';
import { API_BASE_URL } from '../config/env';

export class AdminApi {
  constructor(private request: APIRequestContext) {}

  async cleanDatabase(): Promise<void> {
    const response = await this.request.post(`${API_BASE_URL}/cleanDB`);

    console.log('Clean DB Status:', response.status());

    expect(response.status()).toBe(204);
  }

  async initializeDatabase(): Promise<void> {
    const response = await this.request.post(`${API_BASE_URL}/initializeDB`);

    console.log('Initialize DB Status:', response.status());

    expect(response.status()).toBe(204);
  }

  async setLoanProviderToWebService(): Promise<void> {
    const response = await this.request.post(
      `${API_BASE_URL}/setParameter/loanProvider/ws`
    );

    console.log('Set Loan Provider Status:', response.status());

    expect(response.status()).toBe(204);
  }

  
  async depositFunds(accountId: string, amount: string): Promise<string> {
    const response = await this.request.post(`${API_BASE_URL}/deposit`, {
      params: { accountId, amount },
      headers: { Accept: 'application/json' },
    });

    expect(response.status()).toBe(200);
    return await response.text();
  }

  async getTransactionHistory(accountId: string): Promise<unknown> {
    const response = await this.request.get(
      `${API_BASE_URL}/accounts/${encodeURIComponent(accountId)}/transactions`,
      { headers: { Accept: 'application/json' } },
    );

    expect(response.status()).toBe(200);
    return await response.json();
  }

  
  async login(username: string, password: string): Promise<number> {
    const response = await this.request.get(
      `${API_BASE_URL}/login/${encodeURIComponent(username)}/${encodeURIComponent(password)}`,
      { headers: { Accept: 'application/json' } },
    );

    expect(response.status()).toBe(200);

    const customer: unknown = await response.json();

    if (
      typeof customer !== 'object' ||
      customer === null ||
      !('id' in customer) ||
      typeof customer.id !== 'number'
    ) {
      throw new Error('Login response did not contain a numeric customer id.');
    }

    return customer.id;
  }

  async getCustomerAccounts(
    customerId: number,
  ): Promise<Array<{ id: number; balance: number }>> {
    const response = await this.request.get(
      `${API_BASE_URL}/customers/${customerId}/accounts`,
      { headers: { Accept: 'application/json' } },
    );

    expect(response.status()).toBe(200);

    const data: unknown = await response.json();

    if (
      !Array.isArray(data) ||
      !data.every(
        (account: unknown) =>
          typeof account === 'object' &&
          account !== null &&
          'id' in account &&
          typeof account.id === 'number' &&
          'balance' in account &&
          (typeof account.balance === 'number' ||
            typeof account.balance === 'string'),
      )
    ) {
      throw new Error('Accounts API returned an unexpected response shape.');
    }

    return data.map((account) => ({
      id: account.id,
      balance: Number(account.balance),
    }));
  }
}
