import { test as base, expect } from '@playwright/test';
import { AdminApi } from '../api/AdminApi';

type Fixtures = {
  adminApi: AdminApi;
};

export const test = base.extend<Fixtures>({
  adminApi: async ({ request }, use) => {
    await use(new AdminApi(request));
  },
});

export { expect };