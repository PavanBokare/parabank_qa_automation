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
  const uniqueId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  return {
    firstName: 'Test',
    lastName: 'User',
    address: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    zipCode: '440001',
    phoneNumber: '9876543210',
    ssn: '123456789',
    username: `qa_test_${uniqueId}`,
    password: 'Test@12345',
  };
}

export interface LoanRequestData {
  amount: number;
  downPayment: number;
}

/**
 * Loan values for Scenario A — kept as test data outside Page Objects.
 * Verified against the public environment: amount=500 with downPayment=50 is
 * approved when the source checking balance is $100.00 (downPayment <= balance).
 */
export const loanRequest: LoanRequestData = {
  amount: 500,
  downPayment: 50,
};