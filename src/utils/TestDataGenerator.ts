import { randomUUID } from 'node:crypto';

import loanRequestJson from '../../testData/loan-request.json';

export interface UserData {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  ssn: string;
  username: string;
  password: string;
}

export function generateUser(): UserData {
  const uniqueId = randomUUID().replace(/-/g, '').slice(0, 16);

  return {
    firstName: 'Test',
    lastName: 'User',
    address: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    zipCode: '440001',
    phoneNumber: '9876543210',
    ssn: '123456789',
    username: `qa_${uniqueId}`,
    password: 'Test@12345',
  };
}

export interface LoanRequestData {
  amount: number;
  downPayment: number;
}

/**
 * Loan values for Scenario A — data lives in testData/loan-request.json;
 * this typed export keeps existing consumers unchanged.
 * Verified against the public environment: amount=500 with downPayment=50 is
 * approved when the source checking balance is $100.00 (downPayment <= balance).
 */
export const loanRequest: LoanRequestData = {
  amount: loanRequestJson.amount,
  downPayment: loanRequestJson.downPayment,
};